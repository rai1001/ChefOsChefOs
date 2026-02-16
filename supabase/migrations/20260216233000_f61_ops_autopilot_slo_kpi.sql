-- F6.1: Auto-remediation, automatic escalation, SLO/SLI and weekly KPI snapshots

-- =====================================================
-- 1) Extend incidents and incident events
-- =====================================================
ALTER TABLE public.ops_incidents
  ADD COLUMN IF NOT EXISTS auto_remediation_state text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS auto_remediation_last_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_state text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_escalation_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS root_cause text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_incidents_auto_remediation_state_check'
  ) THEN
    ALTER TABLE public.ops_incidents
      ADD CONSTRAINT ops_incidents_auto_remediation_state_check
      CHECK (auto_remediation_state IN ('idle', 'running', 'success', 'failed', 'cooldown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_incidents_escalation_state_check'
  ) THEN
    ALTER TABLE public.ops_incidents
      ADD CONSTRAINT ops_incidents_escalation_state_check
      CHECK (escalation_state IN ('none', 'escalated', 'reminder', 'acknowledged'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_incidents_escalation_level_check'
  ) THEN
    ALTER TABLE public.ops_incidents
      ADD CONSTRAINT ops_incidents_escalation_level_check
      CHECK (escalation_level >= 0 AND escalation_level <= 10);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ops_incidents_escalation
  ON public.ops_incidents(hotel_id, escalation_state, escalation_level, opened_at DESC);

ALTER TABLE public.ops_incident_events
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_incident_events_event_type_check'
  ) THEN
    ALTER TABLE public.ops_incident_events
      DROP CONSTRAINT ops_incident_events_event_type_check;
  END IF;

  ALTER TABLE public.ops_incident_events
    ADD CONSTRAINT ops_incident_events_event_type_check
    CHECK (
      event_type IN (
        'opened',
        'acknowledged',
        'comment',
        'status_changed',
        'resolved',
        'runbook_linked',
        'watchdog_triggered',
        'auto_remediation',
        'auto_resolved',
        'escalation',
        'escalation_reminder'
      )
    );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ops_incident_events_actor_type_check'
  ) THEN
    ALTER TABLE public.ops_incident_events
      ADD CONSTRAINT ops_incident_events_actor_type_check
      CHECK (actor_type IN ('user', 'system', 'openclaw'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ops_incident_events_actor_type
  ON public.ops_incident_events(hotel_id, actor_type, created_at DESC);

-- =====================================================
-- 2) Auto-remediation and escalation tables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ops_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.ops_incidents(id) ON DELETE CASCADE,
  service_key text NOT NULL DEFAULT 'global',
  action_key text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'watchdog',
  result_status text NOT NULL CHECK (result_status IN ('success', 'failed', 'skipped')),
  detail text,
  duration_ms integer,
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  cooldown_applied boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ops_automation_runs_hotel_created
  ON public.ops_automation_runs(hotel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_automation_runs_incident
  ON public.ops_automation_runs(incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ops_automation_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.ops_incidents(id) ON DELETE CASCADE,
  service_key text NOT NULL DEFAULT 'global',
  action_key text NOT NULL,
  cooldown_until timestamptz NOT NULL,
  last_result text NOT NULL DEFAULT 'success' CHECK (last_result IN ('success', 'failed', 'skipped')),
  last_run_at timestamptz NOT NULL DEFAULT now(),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, incident_id, service_key, action_key)
);

CREATE INDEX IF NOT EXISTS idx_ops_automation_cooldowns_hotel_until
  ON public.ops_automation_cooldowns(hotel_id, cooldown_until DESC);

DROP TRIGGER IF EXISTS set_ops_automation_cooldowns_updated_at ON public.ops_automation_cooldowns;
CREATE TRIGGER set_ops_automation_cooldowns_updated_at
BEFORE UPDATE ON public.ops_automation_cooldowns
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.ops_escalation_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  escalate_after_minutes integer NOT NULL CHECK (escalate_after_minutes >= 0),
  reminder_every_minutes integer NOT NULL CHECK (reminder_every_minutes >= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, severity)
);

CREATE INDEX IF NOT EXISTS idx_ops_escalation_policies_hotel_severity
  ON public.ops_escalation_policies(hotel_id, severity, active);

DROP TRIGGER IF EXISTS set_ops_escalation_policies_updated_at ON public.ops_escalation_policies;
CREATE TRIGGER set_ops_escalation_policies_updated_at
BEFORE UPDATE ON public.ops_escalation_policies
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.ops_escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES public.ops_incidents(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'suppressed')),
  escalated_at timestamptz NOT NULL DEFAULT now(),
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  next_reminder_at timestamptz NOT NULL,
  reminder_count integer NOT NULL DEFAULT 0 CHECK (reminder_count >= 0),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (incident_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_escalations_hotel_active
  ON public.ops_escalations(hotel_id, status, next_reminder_at);

DROP TRIGGER IF EXISTS set_ops_escalations_updated_at ON public.ops_escalations;
CREATE TRIGGER set_ops_escalations_updated_at
BEFORE UPDATE ON public.ops_escalations
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- =====================================================
-- 3) SLO targets and weekly snapshots
-- =====================================================
CREATE TABLE IF NOT EXISTS public.ops_slo_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  uptime_target_24h numeric NOT NULL DEFAULT 99.50 CHECK (uptime_target_24h BETWEEN 80 AND 100),
  uptime_target_7d numeric NOT NULL DEFAULT 99.90 CHECK (uptime_target_7d BETWEEN 80 AND 100),
  mtta_target_minutes integer NOT NULL DEFAULT 10 CHECK (mtta_target_minutes BETWEEN 1 AND 10080),
  mttr_target_minutes integer NOT NULL DEFAULT 60 CHECK (mttr_target_minutes BETWEEN 1 AND 10080),
  max_open_incidents_target integer NOT NULL DEFAULT 5 CHECK (max_open_incidents_target BETWEEN 1 AND 500),
  service_targets jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_slo_targets_hotel
  ON public.ops_slo_targets(hotel_id);

DROP TRIGGER IF EXISTS set_ops_slo_targets_updated_at ON public.ops_slo_targets;
CREATE TRIGGER set_ops_slo_targets_updated_at
BEFORE UPDATE ON public.ops_slo_targets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.ops_weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  week_end date NOT NULL,
  total_incidents integer NOT NULL DEFAULT 0 CHECK (total_incidents >= 0),
  auto_resolved_pct numeric NOT NULL DEFAULT 0 CHECK (auto_resolved_pct BETWEEN 0 AND 100),
  mtta_minutes numeric,
  mttr_minutes numeric,
  root_causes jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_by text NOT NULL DEFAULT 'system',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hotel_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_ops_weekly_snapshots_hotel_week
  ON public.ops_weekly_snapshots(hotel_id, week_start DESC);

-- Seed escalation policies and SLO targets for existing hotels
INSERT INTO public.ops_escalation_policies (hotel_id, severity, escalate_after_minutes, reminder_every_minutes, active)
SELECT h.id, seed.severity, seed.escalate_after_minutes, seed.reminder_every_minutes, true
FROM public.hotels h
CROSS JOIN (
  VALUES
    ('critical', 0, 15),
    ('high', 30, 30),
    ('medium', 120, 120),
    ('low', 240, 240)
) AS seed(severity, escalate_after_minutes, reminder_every_minutes)
ON CONFLICT (hotel_id, severity) DO NOTHING;

INSERT INTO public.ops_slo_targets (
  hotel_id,
  uptime_target_24h,
  uptime_target_7d,
  mtta_target_minutes,
  mttr_target_minutes,
  max_open_incidents_target,
  service_targets
)
SELECT
  h.id,
  99.50,
  99.90,
  10,
  60,
  5,
  jsonb_build_object(
    'web_app', 99.90,
    'sync_pipeline', 99.50,
    'jobs_worker', 99.50,
    'alert_dispatcher', 99.90,
    'backup_monitor', 99.90
  )
FROM public.hotels h
ON CONFLICT (hotel_id) DO NOTHING;

-- =====================================================
-- 4) RLS for new tables
-- =====================================================
ALTER TABLE public.ops_automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_automation_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_escalation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_escalations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_slo_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_weekly_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hotel ops can view automation runs" ON public.ops_automation_runs;
CREATE POLICY "Hotel ops can view automation runs"
ON public.ops_automation_runs
FOR SELECT
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can insert automation runs" ON public.ops_automation_runs;
CREATE POLICY "Hotel ops can insert automation runs"
ON public.ops_automation_runs
FOR INSERT
TO authenticated
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can view automation cooldowns" ON public.ops_automation_cooldowns;
CREATE POLICY "Hotel ops can view automation cooldowns"
ON public.ops_automation_cooldowns
FOR SELECT
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can manage automation cooldowns" ON public.ops_automation_cooldowns;
CREATE POLICY "Hotel ops can manage automation cooldowns"
ON public.ops_automation_cooldowns
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can view escalation policies" ON public.ops_escalation_policies;
CREATE POLICY "Hotel ops can view escalation policies"
ON public.ops_escalation_policies
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage escalation policies" ON public.ops_escalation_policies;
CREATE POLICY "Hotel management can manage escalation policies"
ON public.ops_escalation_policies
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can view escalations" ON public.ops_escalations;
CREATE POLICY "Hotel ops can view escalations"
ON public.ops_escalations
FOR SELECT
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can manage escalations" ON public.ops_escalations;
CREATE POLICY "Hotel ops can manage escalations"
ON public.ops_escalations
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can view slo targets" ON public.ops_slo_targets;
CREATE POLICY "Hotel ops can view slo targets"
ON public.ops_slo_targets
FOR SELECT
TO authenticated
USING (
  hotel_id = public.get_user_hotel_id()
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage slo targets" ON public.ops_slo_targets;
CREATE POLICY "Hotel management can manage slo targets"
ON public.ops_slo_targets
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel ops can view weekly snapshots" ON public.ops_weekly_snapshots;
CREATE POLICY "Hotel ops can view weekly snapshots"
ON public.ops_weekly_snapshots
FOR SELECT
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_produccion()
    OR public.is_rrhh()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS "Hotel management can manage weekly snapshots" ON public.ops_weekly_snapshots;
CREATE POLICY "Hotel management can manage weekly snapshots"
ON public.ops_weekly_snapshots
FOR ALL
TO authenticated
USING (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
)
WITH CHECK (
  (hotel_id = public.get_user_hotel_id() AND (
    public.has_management_access()
    OR public.is_super_admin()
  ))
  OR public.is_super_admin()
);

-- =====================================================
-- 5) SLO/SLI views
-- =====================================================
CREATE OR REPLACE VIEW public.ops_service_sli_view AS
WITH base AS (
  SELECT
    h.hotel_id,
    h.service_key,
    h.status,
    h.queue_depth,
    h.observed_at,
    CASE WHEN h.status = 'down' THEN 0 ELSE 1 END AS up_score
  FROM public.ops_service_heartbeats h
  WHERE h.observed_at >= now() - interval '7 days'
)
SELECT
  hotel_id,
  service_key,
  round((avg(up_score) FILTER (WHERE observed_at >= now() - interval '24 hours') * 100)::numeric, 2) AS uptime_24h_pct,
  round((avg(up_score) * 100)::numeric, 2) AS uptime_7d_pct,
  count(*) FILTER (WHERE observed_at >= now() - interval '24 hours')::integer AS samples_24h,
  count(*)::integer AS samples_7d,
  max(observed_at) AS last_observed_at,
  max(queue_depth) FILTER (WHERE observed_at >= now() - interval '24 hours')::integer AS max_queue_24h
FROM base
GROUP BY hotel_id, service_key;

CREATE OR REPLACE VIEW public.ops_incident_sli_view AS
WITH mtta AS (
  SELECT
    hotel_id,
    round(avg(extract(epoch FROM (acknowledged_at - opened_at)) / 60.0)::numeric, 2) AS mtta_minutes_30d
  FROM public.ops_incidents
  WHERE acknowledged_at IS NOT NULL
    AND opened_at >= now() - interval '30 days'
  GROUP BY hotel_id
),
mttr AS (
  SELECT
    hotel_id,
    round(avg(extract(epoch FROM (resolved_at - opened_at)) / 60.0)::numeric, 2) AS mttr_minutes_30d
  FROM public.ops_incidents
  WHERE resolved_at IS NOT NULL
    AND opened_at >= now() - interval '30 days'
  GROUP BY hotel_id
),
severity_counts AS (
  SELECT
    x.hotel_id,
    jsonb_object_agg(x.severity, x.total) AS incidents_by_severity_30d
  FROM (
    SELECT hotel_id, severity, count(*)::integer AS total
    FROM public.ops_incidents
    WHERE opened_at >= now() - interval '30 days'
    GROUP BY hotel_id, severity
  ) x
  GROUP BY x.hotel_id
),
open_backlog AS (
  SELECT
    hotel_id,
    count(*) FILTER (WHERE now() - opened_at < interval '30 minutes')::integer AS lt_30m,
    count(*) FILTER (WHERE now() - opened_at >= interval '30 minutes' AND now() - opened_at < interval '2 hours')::integer AS btw_30m_2h,
    count(*) FILTER (WHERE now() - opened_at >= interval '2 hours' AND now() - opened_at < interval '8 hours')::integer AS btw_2h_8h,
    count(*) FILTER (WHERE now() - opened_at >= interval '8 hours')::integer AS gte_8h,
    count(*)::integer AS total_open
  FROM public.ops_incidents
  WHERE status <> 'resolved'
  GROUP BY hotel_id
)
SELECT
  h.id AS hotel_id,
  coalesce(mtta.mtta_minutes_30d, 0) AS mtta_minutes_30d,
  coalesce(mttr.mttr_minutes_30d, 0) AS mttr_minutes_30d,
  coalesce(severity_counts.incidents_by_severity_30d, '{}'::jsonb) AS incidents_by_severity_30d,
  jsonb_build_object(
    'lt_30m', coalesce(open_backlog.lt_30m, 0),
    'btw_30m_2h', coalesce(open_backlog.btw_30m_2h, 0),
    'btw_2h_8h', coalesce(open_backlog.btw_2h_8h, 0),
    'gte_8h', coalesce(open_backlog.gte_8h, 0),
    'total_open', coalesce(open_backlog.total_open, 0)
  ) AS open_backlog_by_age
FROM public.hotels h
LEFT JOIN mtta ON mtta.hotel_id = h.id
LEFT JOIN mttr ON mttr.hotel_id = h.id
LEFT JOIN severity_counts ON severity_counts.hotel_id = h.id
LEFT JOIN open_backlog ON open_backlog.hotel_id = h.id;

GRANT SELECT ON public.ops_service_sli_view TO authenticated;
GRANT SELECT ON public.ops_incident_sli_view TO authenticated;

-- =====================================================
-- 6) Autopilot health view for Operations panel
-- =====================================================
CREATE OR REPLACE VIEW public.ops_autopilot_health_view
WITH (security_invoker = true)
AS
WITH recent AS (
  SELECT
    r.hotel_id,
    r.result_status,
    r.duration_ms,
    r.created_at
  FROM public.ops_automation_runs r
  WHERE r.created_at >= now() - interval '30 minutes'
),
agg AS (
  SELECT
    hotel_id,
    count(*)::integer AS runs_30m,
    count(*) FILTER (WHERE result_status = 'success')::integer AS success_count_30m,
    count(*) FILTER (WHERE result_status = 'failed')::integer AS failed_count_30m,
    count(*) FILTER (WHERE result_status = 'skipped')::integer AS skipped_count_30m,
    round(avg(duration_ms)::numeric, 2) AS avg_duration_ms_30m,
    max(created_at) AS last_run_at,
    max(created_at) FILTER (WHERE result_status = 'success') AS last_success_at,
    max(created_at) FILTER (WHERE result_status = 'failed') AS last_failure_at
  FROM recent
  GROUP BY hotel_id
)
SELECT
  h.id AS hotel_id,
  CASE
    WHEN coalesce(agg.runs_30m, 0) = 0 THEN 'degraded'
    WHEN coalesce(agg.failed_count_30m, 0) >= 3
      AND coalesce(agg.success_count_30m, 0) = 0 THEN 'down'
    WHEN coalesce(agg.failed_count_30m, 0) > 0 THEN 'degraded'
    WHEN agg.last_run_at < now() - interval '10 minutes' THEN 'degraded'
    ELSE 'up'
  END AS bridge_status,
  coalesce(agg.runs_30m, 0) AS runs_30m,
  coalesce(agg.success_count_30m, 0) AS success_count_30m,
  coalesce(agg.failed_count_30m, 0) AS failed_count_30m,
  coalesce(agg.skipped_count_30m, 0) AS skipped_count_30m,
  coalesce(agg.avg_duration_ms_30m, 0) AS avg_duration_ms_30m,
  agg.last_run_at,
  agg.last_success_at,
  agg.last_failure_at
FROM public.hotels h
LEFT JOIN agg ON agg.hotel_id = h.id;

ALTER VIEW public.ops_service_sli_view SET (security_invoker = true);
ALTER VIEW public.ops_incident_sli_view SET (security_invoker = true);

GRANT SELECT ON public.ops_autopilot_health_view TO authenticated;
