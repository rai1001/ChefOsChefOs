-- Backlog core implementation:
-- feature flags, telemetry, deterministic ops support, approvals,
-- menu versioning, super admin analytics, and agent signature layer.

-- =====================================================
-- 1) Feature flags by hotel
-- =====================================================
CREATE TABLE IF NOT EXISTS public.hotel_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, feature_key)
);

CREATE INDEX IF NOT EXISTS idx_hotel_feature_flags_hotel_key
  ON public.hotel_feature_flags(hotel_id, feature_key);

ALTER TABLE public.hotel_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view feature flags" ON public.hotel_feature_flags;
CREATE POLICY "Hotel staff can view feature flags"
ON public.hotel_feature_flags
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage feature flags" ON public.hotel_feature_flags;
CREATE POLICY "Hotel management can manage feature flags"
ON public.hotel_feature_flags
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP TRIGGER IF EXISTS set_hotel_feature_flags_updated_at ON public.hotel_feature_flags;
CREATE TRIGGER set_hotel_feature_flags_updated_at
BEFORE UPDATE ON public.hotel_feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Seed known flags as disabled by default.
INSERT INTO public.hotel_feature_flags (hotel_id, feature_key, enabled)
SELECT h.id, f.feature_key, false
FROM public.hotels h
CROSS JOIN (
  VALUES
    ('ai_purchase_suggestions'),
    ('ai_daily_briefing'),
    ('ai_menu_recommender'),
    ('ai_ops_alert_copy'),
    ('clawtbot_integration')
) AS f(feature_key)
ON CONFLICT (hotel_id, feature_key) DO NOTHING;

-- =====================================================
-- 2) Operational audit telemetry
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ops_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  entity text NOT NULL,
  action text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_audit_log_hotel_created
  ON public.ops_audit_log(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_audit_log_entity_action
  ON public.ops_audit_log(entity, action);

ALTER TABLE public.ops_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view ops audit log" ON public.ops_audit_log;
CREATE POLICY "Hotel staff can view ops audit log"
ON public.ops_audit_log
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can insert ops audit log" ON public.ops_audit_log;
CREATE POLICY "Hotel staff can insert ops audit log"
ON public.ops_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_produccion() OR public.is_maitre() OR public.is_rrhh()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Super admins can delete ops audit log" ON public.ops_audit_log;
CREATE POLICY "Super admins can delete ops audit log"
ON public.ops_audit_log
FOR DELETE
TO authenticated
USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.log_ops_audit(
  _hotel_id uuid,
  _entity text,
  _action text,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT (
    _hotel_id = public.get_user_hotel_id()
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.ops_audit_log (
    hotel_id,
    entity,
    action,
    payload,
    actor_user_id
  )
  VALUES (
    _hotel_id,
    _entity,
    _action,
    coalesce(_payload, '{}'::jsonb),
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_ops_audit(uuid, text, text, jsonb) TO authenticated;

-- =====================================================
-- 3) Inventory waste capture
-- =====================================================
CREATE TABLE IF NOT EXISTS public.inventory_waste (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.inventory_lots(id) ON DELETE SET NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  qty numeric NOT NULL CHECK (qty > 0),
  cause text NOT NULL CHECK (cause IN ('expired', 'damage', 'spoilage', 'overproduction', 'handling', 'other')),
  note text,
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_waste_hotel_recorded
  ON public.inventory_waste(hotel_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_waste_product
  ON public.inventory_waste(product_id, recorded_at DESC);

ALTER TABLE public.inventory_waste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view waste" ON public.inventory_waste;
CREATE POLICY "Hotel staff can view waste"
ON public.inventory_waste
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can create waste" ON public.inventory_waste;
CREATE POLICY "Hotel staff can create waste"
ON public.inventory_waste
FOR INSERT
TO authenticated
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_produccion() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can delete waste" ON public.inventory_waste;
CREATE POLICY "Hotel management can delete waste"
ON public.inventory_waste
FOR DELETE
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

CREATE OR REPLACE FUNCTION public.handle_inventory_waste_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory_movements (
    hotel_id,
    lot_id,
    product_id,
    movement_type,
    quantity,
    notes,
    created_by,
    created_at
  )
  VALUES (
    NEW.hotel_id,
    NEW.lot_id,
    NEW.product_id,
    'waste',
    NEW.qty,
    concat('Waste cause: ', NEW.cause, coalesce(' - ' || NEW.note, '')),
    NEW.recorded_by,
    NEW.recorded_at
  );

  IF NEW.lot_id IS NOT NULL THEN
    UPDATE public.inventory_lots
    SET quantity = GREATEST(quantity - NEW.qty, 0)
    WHERE id = NEW.lot_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_waste_after_insert ON public.inventory_waste;
CREATE TRIGGER trg_inventory_waste_after_insert
AFTER INSERT ON public.inventory_waste
FOR EACH ROW
EXECUTE FUNCTION public.handle_inventory_waste_after_insert();

-- =====================================================
-- 4) Event cost variance (baseline vs actual)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.event_cost_baseline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  menu_id uuid REFERENCES public.menus(id) ON DELETE SET NULL,
  pax integer NOT NULL DEFAULT 0,
  baseline_cost_total numeric NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE TABLE IF NOT EXISTS public.event_cost_actual (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  actual_cost_total numeric NOT NULL DEFAULT 0,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_cost_baseline_hotel_event
  ON public.event_cost_baseline(hotel_id, event_id);
CREATE INDEX IF NOT EXISTS idx_event_cost_actual_hotel_event
  ON public.event_cost_actual(hotel_id, event_id);

ALTER TABLE public.event_cost_baseline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_cost_actual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view event baseline costs" ON public.event_cost_baseline;
CREATE POLICY "Hotel staff can view event baseline costs"
ON public.event_cost_baseline
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage event baseline costs" ON public.event_cost_baseline;
CREATE POLICY "Hotel management can manage event baseline costs"
ON public.event_cost_baseline
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_maitre() OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_maitre() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can view event actual costs" ON public.event_cost_actual;
CREATE POLICY "Hotel staff can view event actual costs"
ON public.event_cost_actual
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage event actual costs" ON public.event_cost_actual;
CREATE POLICY "Hotel management can manage event actual costs"
ON public.event_cost_actual
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

CREATE OR REPLACE VIEW public.event_cost_variance_view AS
SELECT
  e.id AS event_id,
  e.hotel_id,
  e.name AS event_name,
  e.event_date,
  e.pax,
  b.baseline_cost_total,
  a.actual_cost_total,
  (coalesce(a.actual_cost_total, 0) - coalesce(b.baseline_cost_total, 0)) AS delta_amount,
  CASE
    WHEN coalesce(b.baseline_cost_total, 0) = 0 THEN NULL
    ELSE ROUND(((coalesce(a.actual_cost_total, 0) - coalesce(b.baseline_cost_total, 0)) / b.baseline_cost_total) * 100, 2)
  END AS delta_pct
FROM public.events e
LEFT JOIN public.event_cost_baseline b ON b.event_id = e.id
LEFT JOIN public.event_cost_actual a ON a.event_id = e.id;

GRANT SELECT ON public.event_cost_variance_view TO authenticated;

-- =====================================================
-- 5) Alert subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.alert_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email')),
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly')),
  enabled boolean NOT NULL DEFAULT true,
  send_at time NOT NULL DEFAULT '07:00',
  weekday integer CHECK (weekday BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, user_id, channel, frequency)
);

CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_hotel_enabled
  ON public.alert_subscriptions(hotel_id, enabled, frequency);

ALTER TABLE public.alert_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own alert subscriptions" ON public.alert_subscriptions;
CREATE POLICY "Users can view own alert subscriptions"
ON public.alert_subscriptions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Users can manage own alert subscriptions" ON public.alert_subscriptions;
CREATE POLICY "Users can manage own alert subscriptions"
ON public.alert_subscriptions
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
  OR (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  user_id = auth.uid()
  OR (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP TRIGGER IF EXISTS set_alert_subscriptions_updated_at ON public.alert_subscriptions;
CREATE TRIGGER set_alert_subscriptions_updated_at
BEFORE UPDATE ON public.alert_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 6) Approval workflow
-- =====================================================
CREATE TABLE IF NOT EXISTS public.approval_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('purchase', 'menu')),
  threshold_amount numeric NOT NULL CHECK (threshold_amount >= 0),
  required_role public.app_role NOT NULL DEFAULT 'admin',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_policies_hotel_entity
  ON public.approval_policies(hotel_id, entity, active);

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('purchase', 'menu')),
  entity_id uuid,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  required_role public.app_role NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')) DEFAULT 'pending',
  amount numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_hotel_status
  ON public.approval_requests(hotel_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_entity
  ON public.approval_requests(entity, entity_id);

CREATE TABLE IF NOT EXISTS public.approval_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  action text NOT NULL CHECK (action IN ('created', 'approved', 'rejected', 'cancelled', 'commented')),
  note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_events_request
  ON public.approval_events(request_id, created_at ASC);

ALTER TABLE public.approval_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view approval policies" ON public.approval_policies;
CREATE POLICY "Hotel staff can view approval policies"
ON public.approval_policies
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage approval policies" ON public.approval_policies;
CREATE POLICY "Hotel management can manage approval policies"
ON public.approval_policies
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can view approval requests" ON public.approval_requests;
CREATE POLICY "Hotel staff can view approval requests"
ON public.approval_requests
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can create approval requests" ON public.approval_requests;
CREATE POLICY "Hotel management can create approval requests"
ON public.approval_requests
FOR INSERT
TO authenticated
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_maitre() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Approvers can resolve approval requests" ON public.approval_requests;
CREATE POLICY "Approvers can resolve approval requests"
ON public.approval_requests
FOR UPDATE
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_role(auth.uid(), required_role) OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_role(auth.uid(), required_role) OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can view approval events" ON public.approval_events;
CREATE POLICY "Hotel staff can view approval events"
ON public.approval_events
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can create approval events" ON public.approval_events;
CREATE POLICY "Hotel staff can create approval events"
ON public.approval_events
FOR INSERT
TO authenticated
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_maitre() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP TRIGGER IF EXISTS set_approval_policies_updated_at ON public.approval_policies;
CREATE TRIGGER set_approval_policies_updated_at
BEFORE UPDATE ON public.approval_policies
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.create_approval_request(
  _hotel_id uuid,
  _entity text,
  _entity_id uuid,
  _amount numeric,
  _payload jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_role public.app_role := 'admin';
  v_request_id uuid;
BEGIN
  IF NOT (
    _hotel_id = public.get_user_hotel_id()
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT p.required_role
  INTO v_required_role
  FROM public.approval_policies p
  WHERE p.hotel_id = _hotel_id
    AND p.entity = _entity
    AND p.active = true
    AND coalesce(_amount, 0) >= p.threshold_amount
  ORDER BY p.threshold_amount DESC
  LIMIT 1;

  IF v_required_role IS NULL THEN
    v_required_role := 'admin';
  END IF;

  INSERT INTO public.approval_requests (
    hotel_id,
    entity,
    entity_id,
    requested_by,
    required_role,
    status,
    amount,
    payload
  )
  VALUES (
    _hotel_id,
    _entity,
    _entity_id,
    auth.uid(),
    v_required_role,
    'pending',
    _amount,
    coalesce(_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.approval_events (
    request_id,
    hotel_id,
    actor_user_id,
    action,
    payload
  )
  VALUES (
    v_request_id,
    _hotel_id,
    auth.uid(),
    'created',
    coalesce(_payload, '{}'::jsonb)
  );

  RETURN v_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_approval_request(uuid, text, uuid, numeric, jsonb) TO authenticated;

-- Seed default policy thresholds.
INSERT INTO public.approval_policies (hotel_id, entity, threshold_amount, required_role, active, created_by)
SELECT h.id, 'purchase', 500, 'jefe_cocina', true, h.created_by
FROM public.hotels h
ON CONFLICT DO NOTHING;

INSERT INTO public.approval_policies (hotel_id, entity, threshold_amount, required_role, active, created_by)
SELECT h.id, 'purchase', 1500, 'admin', true, h.created_by
FROM public.hotels h
ON CONFLICT DO NOTHING;

INSERT INTO public.approval_policies (hotel_id, entity, threshold_amount, required_role, active, created_by)
SELECT h.id, 'menu', 300, 'jefe_cocina', true, h.created_by
FROM public.hotels h
ON CONFLICT DO NOTHING;

-- =====================================================
-- 7) Menu versioning
-- =====================================================
CREATE TABLE IF NOT EXISTS public.menu_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  name text NOT NULL,
  description text,
  type text,
  cost_per_pax numeric,
  is_active boolean,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_menu_versions_hotel_menu
  ON public.menu_versions(hotel_id, menu_id, version_number DESC);

CREATE TABLE IF NOT EXISTS public.menu_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_version_id uuid NOT NULL REFERENCES public.menu_versions(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity_per_pax numeric NOT NULL,
  preparation_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_menu_item_versions_menu_version
  ON public.menu_item_versions(menu_version_id);

ALTER TABLE public.menu_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view menu versions" ON public.menu_versions;
CREATE POLICY "Hotel staff can view menu versions"
ON public.menu_versions
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can create menu versions" ON public.menu_versions;
CREATE POLICY "Hotel management can create menu versions"
ON public.menu_versions
FOR INSERT
TO authenticated
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel staff can view menu item versions" ON public.menu_item_versions;
CREATE POLICY "Hotel staff can view menu item versions"
ON public.menu_item_versions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.menu_versions mv
    WHERE mv.id = menu_version_id
      AND (mv.hotel_id = public.get_user_hotel_id() OR public.is_super_admin())
  )
);

DROP POLICY IF EXISTS "Hotel management can create menu item versions" ON public.menu_item_versions;
CREATE POLICY "Hotel management can create menu item versions"
ON public.menu_item_versions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.menu_versions mv
    WHERE mv.id = menu_version_id
      AND (mv.hotel_id = public.get_user_hotel_id() OR public.is_super_admin())
      AND (public.has_management_access() OR public.is_super_admin())
  )
);

CREATE OR REPLACE FUNCTION public.snapshot_menu_version(
  _menu_id uuid,
  _created_by uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_menu public.menus%ROWTYPE;
  v_version integer;
  v_version_id uuid;
BEGIN
  SELECT *
  INTO v_menu
  FROM public.menus
  WHERE id = _menu_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'menu_not_found';
  END IF;

  IF NOT (
    v_menu.hotel_id = public.get_user_hotel_id()
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT coalesce(max(version_number), 0) + 1
  INTO v_version
  FROM public.menu_versions
  WHERE menu_id = _menu_id;

  INSERT INTO public.menu_versions (
    hotel_id,
    menu_id,
    version_number,
    name,
    description,
    type,
    cost_per_pax,
    is_active,
    snapshot,
    created_by
  )
  VALUES (
    v_menu.hotel_id,
    v_menu.id,
    v_version,
    v_menu.name,
    v_menu.description,
    v_menu.type,
    v_menu.cost_per_pax,
    v_menu.is_active,
    (
      SELECT jsonb_build_object(
        'menu', to_jsonb(v_menu),
        'items', coalesce(jsonb_agg(to_jsonb(mi)), '[]'::jsonb)
      )
      FROM public.menu_items mi
      WHERE mi.menu_id = v_menu.id
    ),
    _created_by
  )
  RETURNING id INTO v_version_id;

  INSERT INTO public.menu_item_versions (
    menu_version_id,
    product_id,
    quantity_per_pax,
    preparation_notes
  )
  SELECT
    v_version_id,
    mi.product_id,
    mi.quantity_per_pax,
    mi.preparation_notes
  FROM public.menu_items mi
  WHERE mi.menu_id = v_menu.id;

  RETURN v_version_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.snapshot_menu_version(uuid, uuid) TO authenticated;

-- =====================================================
-- 8) Agent connection signature layer
-- =====================================================
CREATE TABLE IF NOT EXISTS public.agent_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  agent_name text NOT NULL DEFAULT 'clawtbot',
  agent_id text NOT NULL,
  public_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  allowed_scopes text[] NOT NULL DEFAULT ARRAY['read:events', 'read:tasks', 'read:inventory'],
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, agent_id),
  UNIQUE (agent_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_connections_hotel_status
  ON public.agent_connections(hotel_id, status);

CREATE TABLE IF NOT EXISTS public.agent_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  agent_connection_id uuid NOT NULL REFERENCES public.agent_connections(id) ON DELETE CASCADE,
  nonce text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE (agent_connection_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_agent_nonces_expires_at
  ON public.agent_nonces(expires_at);

ALTER TABLE public.agent_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_nonces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel staff can view agent connections" ON public.agent_connections;
CREATE POLICY "Hotel staff can view agent connections"
ON public.agent_connections
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage agent connections" ON public.agent_connections;
CREATE POLICY "Hotel management can manage agent connections"
ON public.agent_connections
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can view agent nonces" ON public.agent_nonces;
CREATE POLICY "Hotel management can view agent nonces"
ON public.agent_nonces
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can delete agent nonces" ON public.agent_nonces;
CREATE POLICY "Hotel management can delete agent nonces"
ON public.agent_nonces
FOR DELETE
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (public.has_management_access() OR public.is_super_admin()))
  OR public.is_super_admin()
);

DROP TRIGGER IF EXISTS set_agent_connections_updated_at ON public.agent_connections;
CREATE TRIGGER set_agent_connections_updated_at
BEFORE UPDATE ON public.agent_connections
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.cleanup_agent_nonces()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.agent_nonces
  WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_agent_nonces() TO authenticated;

-- =====================================================
-- 9) Super admin analytics view
-- =====================================================
CREATE OR REPLACE VIEW public.superadmin_hotel_benchmarks AS
WITH waste_30d AS (
  SELECT
    hotel_id,
    coalesce(sum(qty), 0) AS waste_qty
  FROM public.inventory_waste
  WHERE recorded_at >= now() - interval '30 days'
  GROUP BY hotel_id
),
tasks_30d AS (
  SELECT
    hotel_id,
    count(*) AS total_tasks,
    count(*) FILTER (WHERE status = 'completed') AS completed_tasks
  FROM public.production_tasks
  WHERE task_date >= current_date - interval '30 days'
  GROUP BY hotel_id
),
purchases_30d AS (
  SELECT
    hotel_id,
    count(*) FILTER (WHERE status = 'received') AS received_orders,
    count(*) FILTER (
      WHERE status = 'received'
        AND expected_date IS NOT NULL
        AND received_at IS NOT NULL
        AND date(received_at) <= expected_date
    ) AS on_time_orders
  FROM public.purchases
  WHERE order_date >= current_date - interval '30 days'
  GROUP BY hotel_id
),
cost_30d AS (
  SELECT
    e.hotel_id,
    coalesce(sum(a.actual_cost_total), 0) AS actual_cost_total,
    coalesce(sum(e.pax), 0) AS total_pax
  FROM public.events e
  LEFT JOIN public.event_cost_actual a ON a.event_id = e.id
  WHERE e.event_date >= current_date - interval '30 days'
  GROUP BY e.hotel_id
)
SELECT
  h.id AS hotel_id,
  h.name AS hotel_name,
  coalesce(c.actual_cost_total, 0) AS actual_cost_total_30d,
  coalesce(c.total_pax, 0) AS total_pax_30d,
  CASE
    WHEN coalesce(c.total_pax, 0) = 0 THEN 0
    ELSE round(c.actual_cost_total / c.total_pax, 2)
  END AS cost_per_pax_30d,
  coalesce(w.waste_qty, 0) AS waste_qty_30d,
  coalesce(t.total_tasks, 0) AS total_tasks_30d,
  coalesce(t.completed_tasks, 0) AS completed_tasks_30d,
  CASE
    WHEN coalesce(t.total_tasks, 0) = 0 THEN 0
    ELSE round((t.completed_tasks::numeric / t.total_tasks::numeric) * 100, 2)
  END AS task_completion_pct_30d,
  coalesce(p.received_orders, 0) AS received_orders_30d,
  coalesce(p.on_time_orders, 0) AS on_time_orders_30d,
  CASE
    WHEN coalesce(p.received_orders, 0) = 0 THEN 0
    ELSE round((p.on_time_orders::numeric / p.received_orders::numeric) * 100, 2)
  END AS purchase_on_time_pct_30d
FROM public.hotels h
LEFT JOIN waste_30d w ON w.hotel_id = h.id
LEFT JOIN tasks_30d t ON t.hotel_id = h.id
LEFT JOIN purchases_30d p ON p.hotel_id = h.id
LEFT JOIN cost_30d c ON c.hotel_id = h.id;

GRANT SELECT ON public.superadmin_hotel_benchmarks TO authenticated;
