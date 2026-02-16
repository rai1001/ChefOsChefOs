-- F6: 24/7 operations center - monitoring, watchdog, incidents and runbooks

-- 1) Service heartbeats ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_service_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  service_key text NOT NULL CHECK (
    service_key IN ('web_app', 'sync_pipeline', 'jobs_worker', 'alert_dispatcher', 'backup_monitor')
  ),
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'degraded', 'down')),
  latency_ms integer,
  queue_depth integer NOT NULL DEFAULT 0,
  detail text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_ops_service_heartbeats_hotel_observed
  ON public.ops_service_heartbeats(hotel_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_service_heartbeats_service
  ON public.ops_service_heartbeats(hotel_id, service_key, observed_at DESC);

ALTER TABLE public.ops_service_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel ops can view service heartbeats" ON public.ops_service_heartbeats;
CREATE POLICY "Hotel ops can view service heartbeats"
ON public.ops_service_heartbeats
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can insert service heartbeats" ON public.ops_service_heartbeats;
CREATE POLICY "Hotel ops can insert service heartbeats"
ON public.ops_service_heartbeats
FOR INSERT
TO authenticated
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Super admins can delete service heartbeats" ON public.ops_service_heartbeats;
CREATE POLICY "Super admins can delete service heartbeats"
ON public.ops_service_heartbeats
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- 2) Incidents ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  title text NOT NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'mitigated', 'resolved')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('system', 'sync', 'jobs', 'backup', 'manual')),
  summary text,
  runbook_slug text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id),
  resolved_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_incidents_hotel_status_opened
  ON public.ops_incidents(hotel_id, status, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_incidents_hotel_severity
  ON public.ops_incidents(hotel_id, severity, opened_at DESC);

ALTER TABLE public.ops_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel ops can view incidents" ON public.ops_incidents;
CREATE POLICY "Hotel ops can view incidents"
ON public.ops_incidents
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can create incidents" ON public.ops_incidents;
CREATE POLICY "Hotel ops can create incidents"
ON public.ops_incidents
FOR INSERT
TO authenticated
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can update incidents" ON public.ops_incidents;
CREATE POLICY "Hotel ops can update incidents"
ON public.ops_incidents
FOR UPDATE
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Super admins can delete incidents" ON public.ops_incidents;
CREATE POLICY "Super admins can delete incidents"
ON public.ops_incidents
FOR DELETE
TO authenticated
USING (public.is_super_admin());

DROP TRIGGER IF EXISTS set_ops_incidents_updated_at ON public.ops_incidents;
CREATE TRIGGER set_ops_incidents_updated_at
BEFORE UPDATE ON public.ops_incidents
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 3) Incident timeline -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_incident_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES public.ops_incidents(id) ON DELETE CASCADE,
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN ('opened', 'acknowledged', 'comment', 'status_changed', 'resolved', 'runbook_linked', 'watchdog_triggered')
  ),
  note text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_incident_events_incident_created
  ON public.ops_incident_events(incident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_incident_events_hotel_created
  ON public.ops_incident_events(hotel_id, created_at DESC);

ALTER TABLE public.ops_incident_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel ops can view incident events" ON public.ops_incident_events;
CREATE POLICY "Hotel ops can view incident events"
ON public.ops_incident_events
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can create incident events" ON public.ops_incident_events;
CREATE POLICY "Hotel ops can create incident events"
ON public.ops_incident_events
FOR INSERT
TO authenticated
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Super admins can delete incident events" ON public.ops_incident_events;
CREATE POLICY "Super admins can delete incident events"
ON public.ops_incident_events
FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- 4) Runbooks ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_runbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('system', 'sync', 'jobs', 'backup', 'inventory', 'purchases', 'tasks', 'other')),
  trigger_pattern text,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_ops_runbooks_hotel_category
  ON public.ops_runbooks(hotel_id, category, active);

ALTER TABLE public.ops_runbooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel ops can view runbooks" ON public.ops_runbooks;
CREATE POLICY "Hotel ops can view runbooks"
ON public.ops_runbooks
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage runbooks" ON public.ops_runbooks;
CREATE POLICY "Hotel management can manage runbooks"
ON public.ops_runbooks
FOR ALL
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
)
WITH CHECK (
  hotel_id = public.get_user_hotel_id()
  AND (
    public.has_management_access()
    OR public.is_super_admin()
  )
  OR public.is_super_admin()
);

DROP TRIGGER IF EXISTS set_ops_runbooks_updated_at ON public.ops_runbooks;
CREATE TRIGGER set_ops_runbooks_updated_at
BEFORE UPDATE ON public.ops_runbooks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Seed default runbooks for every hotel
INSERT INTO public.ops_runbooks (hotel_id, slug, title, category, trigger_pattern, steps, is_default, active)
SELECT
  h.id,
  seed.slug,
  seed.title,
  seed.category,
  seed.trigger_pattern,
  seed.steps,
  true,
  true
FROM public.hotels h
CROSS JOIN (
  VALUES
    (
      'system-degraded',
      'Recuperacion: sistema degradado',
      'system',
      'latencia alta|status warning|status critical',
      jsonb_build_array(
        'Verificar conectividad de internet y DNS del hotel.',
        'Comprobar latencia DB en /status y registrar heartbeat web_app.',
        'Si persiste >10 min, abrir incidente critico y notificar direccion.'
      )
    ),
    (
      'sync-delayed',
      'Recuperacion: sincronizacion retrasada',
      'sync',
      'sync atrasado|heartbeat atrasado',
      jsonb_build_array(
        'Validar ultima importacion de forecast/eventos.',
        'Forzar importacion manual desde modulo correspondiente.',
        'Registrar heartbeat sync_pipeline al completar y cerrar incidente.'
      )
    ),
    (
      'jobs-queue-backlog',
      'Recuperacion: watchdog de jobs/colas',
      'jobs',
      'cola alta|jobs worker down',
      jsonb_build_array(
        'Revisar backlog de cola en centro de operacion 24/7.',
        'Reintentar job bloqueado y registrar resultado en timeline del incidente.',
        'Escalar si backlog >= 25 durante mas de 15 minutos.'
      )
    ),
    (
      'backup-restore',
      'Recuperacion: backup y restauracion',
      'backup',
      'backup sin verificacion|restore_test',
      jsonb_build_array(
        'Ejecutar prueba de restauracion en entorno seguro.',
        'Documentar hora, responsable y resultado en evento de incidente.',
        'Registrar validacion final en /status y actualizar estado a resolved.'
      )
    )
) AS seed(slug, title, category, trigger_pattern, steps)
ON CONFLICT (hotel_id, slug) DO NOTHING;
