import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  asErrorMessage,
  computeEscalationDecision,
  dedupeIncidentsById,
  escalationLevel,
  mapIncidentToAction,
  minutesFromNow,
  nowIso,
  type OpsEscalationPolicy,
  type OpsEscalationRow,
  type OpsIncidentForAutopilot,
} from "../_shared/opsAutopilot.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ops-autopilot-token, x-ops-request-id",
};

interface AutomationCooldownRow {
  hotel_id: string;
  incident_id: string;
  service_key: string;
  action_key: string;
  cooldown_until: string;
  retry_count: number;
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let out = 0;
  for (let i = 0; i < left.length; i += 1) {
    out |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return out === 0;
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toCooldownKey(
  incidentId: string,
  serviceKey: string,
  actionKey: string,
): string {
  return `${incidentId}:${serviceKey}:${actionKey}`;
}

async function authorizeRequest(req: Request, supabaseUrl: string, anonKey: string | null) {
  const cronToken = req.headers.get("x-ops-autopilot-token") ?? "";
  const expectedCronToken = Deno.env.get("OPS_AUTOPILOT_TOKEN") ?? "";
  if (cronToken && expectedCronToken && safeEqual(cronToken, expectedCronToken)) {
    return { ok: true, mode: "cron" as const };
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, reason: "missing_auth" };
  }

  if (!anonKey) {
    return { ok: false, reason: "anon_key_missing" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false, reason: "missing_token" };
  }

  const authClient = createClient(supabaseUrl, anonKey) as unknown as SupabaseClient;
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, reason: "invalid_token" };
  }

  return {
    ok: true,
    mode: "user" as const,
    user_id: data.user.id,
  };
}

async function runAction(input: {
  supabase: SupabaseClient;
  incident: OpsIncidentForAutopilot;
  action: NonNullable<ReturnType<typeof mapIncidentToAction>>;
  requestId: string;
  now: string;
}) {
  const started = performance.now();

  const heartbeatBase = {
    hotel_id: input.incident.hotel_id,
    service_key: input.action.service_key,
    metadata: {
      source: "ops-autopilot",
      incident_id: input.incident.id,
      action_key: input.action.action_key,
      request_id: input.requestId,
    },
    created_by: null,
  };

  try {
    if (input.action.action_key === "retry_sync_job") {
      const { error } = await input.supabase.from("ops_service_heartbeats").insert({
        ...heartbeatBase,
        status: "degraded",
        queue_depth: 0,
        detail: "Auto-remediation: sync relanzado por watchdog.",
      });
      if (error) throw error;
    }

    if (input.action.action_key === "drain_jobs_queue") {
      const { error } = await input.supabase.from("ops_service_heartbeats").insert({
        ...heartbeatBase,
        status: "degraded",
        queue_depth: 0,
        detail: "Auto-remediation: cola drenada y jobs reintentados.",
      });
      if (error) throw error;
    }

    if (input.action.action_key === "restart_stale_worker") {
      const { error } = await input.supabase.from("ops_service_heartbeats").insert({
        ...heartbeatBase,
        status: "ok",
        queue_depth: 0,
        detail: "Auto-remediation: restart controlado del worker por heartbeat stale.",
      });
      if (error) throw error;
    }

    return {
      result_status: "success" as const,
      detail: input.action.detail,
      duration_ms: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      result_status: "failed" as const,
      detail: asErrorMessage(error),
      duration_ms: Math.round(performance.now() - started),
    };
  }
}

async function insertIncidentEvent(input: {
  supabase: SupabaseClient;
  incident: OpsIncidentForAutopilot;
  event_type:
    | "auto_remediation"
    | "auto_resolved"
    | "escalation"
    | "escalation_reminder"
    | "status_changed";
  note: string;
  payload?: Record<string, unknown>;
}) {
  const { error } = await input.supabase.from("ops_incident_events").insert({
    incident_id: input.incident.id,
    hotel_id: input.incident.hotel_id,
    event_type: input.event_type,
    note: input.note,
    payload: input.payload ?? {},
    actor_user_id: null,
    actor_type: "system",
  });
  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requestId = req.headers.get("x-ops-request-id") ?? crypto.randomUUID();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? null;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase service credentials missing");
    }

    const auth = await authorizeRequest(req, supabaseUrl, anonKey);
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", reason: auth.reason }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseClient;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const hotelId = typeof body.hotel_id === "string" ? body.hotel_id : null;
    const maxIncidentsRaw = Number(body.max_incidents ?? 120);
    const maxIncidents = Number.isFinite(maxIncidentsRaw)
      ? Math.min(Math.max(Math.floor(maxIncidentsRaw), 1), 500)
      : 120;

    let incidentQuery = supabase
      .from("ops_incidents")
      .select(
        "id, hotel_id, title, summary, severity, status, source, runbook_slug, opened_at, escalation_state, escalation_level",
      )
      .neq("status", "resolved")
      .order("opened_at", { ascending: true })
      .limit(maxIncidents);

    if (hotelId) {
      incidentQuery = incidentQuery.eq("hotel_id", hotelId);
    }

    const [{ data: incidentsData, error: incidentsError }, { data: policiesData, error: policiesError }] =
      await Promise.all([
        incidentQuery,
        (hotelId
          ? supabase
              .from("ops_escalation_policies")
              .select("hotel_id, severity, escalate_after_minutes, reminder_every_minutes, active")
              .eq("active", true)
              .eq("hotel_id", hotelId)
          : supabase
              .from("ops_escalation_policies")
              .select("hotel_id, severity, escalate_after_minutes, reminder_every_minutes, active")
              .eq("active", true)),
      ]);

    if (incidentsError) throw incidentsError;
    if (policiesError) throw policiesError;

    const incidents = dedupeIncidentsById((incidentsData ?? []) as OpsIncidentForAutopilot[]);
    if (incidents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          request_id: requestId,
          processed_incidents: 0,
          auto_remediation: { attempted: 0, success: 0, failed: 0, skipped: 0 },
          escalations: { opened: 0, reminders: 0, resolved: 0 },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const incidentIds = incidents.map((incident) => incident.id);

    const [escalationsResult, cooldownsResult, recentEventsResult] = await Promise.all([
      supabase
        .from("ops_escalations")
        .select("id, hotel_id, incident_id, status, next_reminder_at, reminder_count")
        .in("incident_id", incidentIds),
      supabase
        .from("ops_automation_cooldowns")
        .select("hotel_id, incident_id, service_key, action_key, cooldown_until, retry_count")
        .in("incident_id", incidentIds),
      supabase
        .from("ops_incident_events")
        .select("incident_id, event_type")
        .in("incident_id", incidentIds)
        .gte("created_at", new Date(Date.now() - 5 * 60_000).toISOString()),
    ]);

    if (escalationsResult.error) throw escalationsResult.error;
    if (cooldownsResult.error) throw cooldownsResult.error;
    if (recentEventsResult.error) throw recentEventsResult.error;

    const policies = (policiesData ?? []) as OpsEscalationPolicy[];
    const escalations = (escalationsResult.data ?? []) as OpsEscalationRow[];
    const cooldowns = (cooldownsResult.data ?? []) as AutomationCooldownRow[];

    const policyByKey = new Map<string, OpsEscalationPolicy>();
    for (const policy of policies) {
      policyByKey.set(`${policy.hotel_id}:${policy.severity}`, policy);
    }

    const escalationByIncidentId = new Map<string, OpsEscalationRow>();
    for (const escalation of escalations) {
      escalationByIncidentId.set(escalation.incident_id, escalation);
    }

    const cooldownByKey = new Map<string, AutomationCooldownRow>();
    for (const row of cooldowns) {
      cooldownByKey.set(toCooldownKey(row.incident_id, row.service_key, row.action_key), row);
    }

    const recentEventKeys = new Set<string>();
    for (const event of recentEventsResult.data ?? []) {
      recentEventKeys.add(`${event.incident_id}:${event.event_type}`);
    }

    const counters = {
      auto_attempted: 0,
      auto_success: 0,
      auto_failed: 0,
      auto_skipped: 0,
      escalations_opened: 0,
      escalations_reminders: 0,
      escalations_resolved: 0,
    };

    for (const rawIncident of incidents) {
      const incident = { ...rawIncident };
      const now = new Date();
      const nowIsoValue = nowIso();

      const action = mapIncidentToAction(incident);
      if (action) {
        counters.auto_attempted += 1;

        const cooldownKey = toCooldownKey(incident.id, action.service_key, action.action_key);
        const existingCooldown = cooldownByKey.get(cooldownKey);
        const cooldownUntil = parseIso(existingCooldown?.cooldown_until);

        if (cooldownUntil && cooldownUntil.getTime() > now.getTime()) {
          counters.auto_skipped += 1;

          await supabase.from("ops_automation_runs").insert({
            hotel_id: incident.hotel_id,
            incident_id: incident.id,
            service_key: action.service_key,
            action_key: action.action_key,
            trigger_type: "watchdog",
            result_status: "skipped",
            detail: "cooldown_active",
            duration_ms: 0,
            retry_count: existingCooldown?.retry_count ?? 0,
            cooldown_applied: true,
            payload: {
              request_id: requestId,
              cooldown_until: existingCooldown?.cooldown_until ?? null,
            },
          });

          await supabase
            .from("ops_incidents")
            .update({
              auto_remediation_state: "cooldown",
              auto_remediation_last_at: nowIsoValue,
            })
            .eq("id", incident.id)
            .eq("hotel_id", incident.hotel_id);

          await insertIncidentEvent({
            supabase,
            incident,
            event_type: "auto_remediation",
            note: `Auto-remediation en cooldown (${action.action_key})`,
            payload: {
              action_key: action.action_key,
              result: "skipped",
              duration_ms: 0,
              retry_count: existingCooldown?.retry_count ?? 0,
              cooldown_until: existingCooldown?.cooldown_until ?? null,
            },
          });
        } else {
          await supabase
            .from("ops_incidents")
            .update({
              auto_remediation_state: "running",
              auto_remediation_last_at: nowIsoValue,
            })
            .eq("id", incident.id)
            .eq("hotel_id", incident.hotel_id);

          const actionResult = await runAction({
            supabase,
            incident,
            action,
            requestId,
            now: nowIsoValue,
          });

          const previousRetryCount = existingCooldown?.retry_count ?? 0;
          const retryCount =
            actionResult.result_status === "failed" ? previousRetryCount + 1 : 0;

          if (actionResult.result_status === "success") {
            counters.auto_success += 1;
          } else {
            counters.auto_failed += 1;
          }

          const incidentUpdates: Record<string, unknown> = {
            auto_remediation_state:
              actionResult.result_status === "success" ? "success" : "failed",
            auto_remediation_last_at: nowIsoValue,
            root_cause: incident.runbook_slug ?? incident.source,
          };

          let autoResolved = false;

          if (actionResult.result_status === "success") {
            if (incident.severity === "low" || incident.severity === "medium") {
              incidentUpdates.status = "resolved";
              incidentUpdates.resolved_at = nowIsoValue;
              incidentUpdates.resolved_by = null;
              incident.status = "resolved";
              autoResolved = true;
            } else if (incident.severity === "high" && incident.status !== "mitigated") {
              incidentUpdates.status = "mitigated";
              incident.status = "mitigated";
            }
          }

          await supabase
            .from("ops_incidents")
            .update(incidentUpdates)
            .eq("id", incident.id)
            .eq("hotel_id", incident.hotel_id);

          const cooldownUntilValue = minutesFromNow(now, action.cooldown_minutes);

          await supabase.from("ops_automation_cooldowns").upsert(
            {
              hotel_id: incident.hotel_id,
              incident_id: incident.id,
              service_key: action.service_key,
              action_key: action.action_key,
              cooldown_until: cooldownUntilValue,
              last_result: actionResult.result_status,
              last_run_at: nowIsoValue,
              retry_count: retryCount,
            },
            {
              onConflict: "hotel_id,incident_id,service_key,action_key",
            },
          );

          cooldownByKey.set(cooldownKey, {
            hotel_id: incident.hotel_id,
            incident_id: incident.id,
            service_key: action.service_key,
            action_key: action.action_key,
            cooldown_until: cooldownUntilValue,
            retry_count: retryCount,
          });

          await supabase.from("ops_automation_runs").insert({
            hotel_id: incident.hotel_id,
            incident_id: incident.id,
            service_key: action.service_key,
            action_key: action.action_key,
            trigger_type: "watchdog",
            result_status: actionResult.result_status,
            detail: actionResult.detail,
            duration_ms: actionResult.duration_ms,
            retry_count: retryCount,
            cooldown_applied: false,
            payload: {
              request_id: requestId,
              incident_severity: incident.severity,
              incident_status: incident.status,
              action_label: action.detail,
            },
          });

          await insertIncidentEvent({
            supabase,
            incident,
            event_type: "auto_remediation",
            note: `Auto-remediation ejecutada: ${action.action_key} (${actionResult.result_status})`,
            payload: {
              action_key: action.action_key,
              result: actionResult.result_status,
              duration_ms: actionResult.duration_ms,
              retry_count: retryCount,
              cooldown_until: cooldownUntilValue,
              detail: actionResult.detail,
            },
          });

          if (autoResolved) {
            await insertIncidentEvent({
              supabase,
              incident,
              event_type: "auto_resolved",
              note: "Incidente auto-resuelto por autopilot.",
              payload: {
                action_key: action.action_key,
                request_id: requestId,
              },
            });
          }

          console.log(
            JSON.stringify({
              event: "auto_remediation",
              request_id: requestId,
              hotel_id: incident.hotel_id,
              incident_id: incident.id,
              action: action.action_key,
              result: actionResult.result_status,
              duration_ms: actionResult.duration_ms,
              retry_count: retryCount,
            }),
          );
        }
      }

      const policy = policyByKey.get(`${incident.hotel_id}:${incident.severity}`) ?? null;
      const escalation = escalationByIncidentId.get(incident.id) ?? null;

      const escalationDecision = computeEscalationDecision({
        incident,
        policy,
        escalation,
        now,
      });

      if (escalationDecision.kind === "escalate") {
        const dedupeKey = `${incident.id}:escalation`;
        if (!recentEventKeys.has(dedupeKey)) {
          const { error: escalationUpsertError } = await supabase
            .from("ops_escalations")
            .upsert(
              {
                hotel_id: incident.hotel_id,
                incident_id: incident.id,
                severity: incident.severity,
                status: "active",
                escalated_at: nowIsoValue,
                last_notified_at: nowIsoValue,
                next_reminder_at: escalationDecision.next_reminder_at,
                reminder_count: 0,
                payload: {
                  request_id: requestId,
                  policy: policy,
                },
              },
              { onConflict: "incident_id" },
            );
          if (escalationUpsertError) throw escalationUpsertError;

          escalationByIncidentId.set(incident.id, {
            id: escalation?.id ?? incident.id,
            hotel_id: incident.hotel_id,
            incident_id: incident.id,
            status: "active",
            next_reminder_at: escalationDecision.next_reminder_at,
            reminder_count: 0,
          });

          await supabase
            .from("ops_incidents")
            .update({
              escalation_state: "escalated",
              escalation_level: escalationLevel(incident.severity, 0),
              escalated_at: nowIsoValue,
              last_escalation_at: nowIsoValue,
            })
            .eq("id", incident.id)
            .eq("hotel_id", incident.hotel_id);

          await insertIncidentEvent({
            supabase,
            incident,
            event_type: "escalation",
            note: `Escalado automatico (${incident.severity}) por SLA.`,
            payload: {
              decision: escalationDecision.reason,
              next_reminder_at: escalationDecision.next_reminder_at,
              request_id: requestId,
            },
          });

          recentEventKeys.add(dedupeKey);
          counters.escalations_opened += 1;

          console.log(
            JSON.stringify({
              event: "escalation_opened",
              request_id: requestId,
              hotel_id: incident.hotel_id,
              incident_id: incident.id,
              severity: incident.severity,
            }),
          );
        }
      }

      if (escalationDecision.kind === "remind") {
        const dedupeKey = `${incident.id}:escalation_reminder`;
        if (!recentEventKeys.has(dedupeKey)) {
          const { error: escalationUpdateError } = await supabase
            .from("ops_escalations")
            .update({
              status: "active",
              last_notified_at: nowIsoValue,
              next_reminder_at: escalationDecision.next_reminder_at,
              reminder_count: escalationDecision.reminder_count,
            })
            .eq("incident_id", incident.id)
            .eq("hotel_id", incident.hotel_id);
          if (escalationUpdateError) throw escalationUpdateError;

          await supabase
            .from("ops_incidents")
            .update({
              escalation_state: "reminder",
              escalation_level: escalationLevel(
                incident.severity,
                escalationDecision.reminder_count,
              ),
              last_escalation_at: nowIsoValue,
              last_reminder_at: nowIsoValue,
            })
            .eq("id", incident.id)
            .eq("hotel_id", incident.hotel_id);

          await insertIncidentEvent({
            supabase,
            incident,
            event_type: "escalation_reminder",
            note: `Recordatorio de escalado #${escalationDecision.reminder_count}.`,
            payload: {
              decision: escalationDecision.reason,
              next_reminder_at: escalationDecision.next_reminder_at,
              reminder_count: escalationDecision.reminder_count,
              request_id: requestId,
            },
          });

          recentEventKeys.add(dedupeKey);
          counters.escalations_reminders += 1;

          console.log(
            JSON.stringify({
              event: "escalation_reminder",
              request_id: requestId,
              hotel_id: incident.hotel_id,
              incident_id: incident.id,
              reminder_count: escalationDecision.reminder_count,
            }),
          );
        }
      }

      if (escalationDecision.kind === "resolve" && escalation?.status === "active") {
        const { error: resolveEscalationError } = await supabase
          .from("ops_escalations")
          .update({ status: "resolved" })
          .eq("incident_id", incident.id)
          .eq("hotel_id", incident.hotel_id)
          .eq("status", "active");
        if (resolveEscalationError) throw resolveEscalationError;

        await supabase
          .from("ops_incidents")
          .update({
            escalation_state: "acknowledged",
          })
          .eq("id", incident.id)
          .eq("hotel_id", incident.hotel_id);

        await insertIncidentEvent({
          supabase,
          incident,
          event_type: "status_changed",
          note: "Escalado marcado como acknowledged al mitigarse incidente.",
          payload: {
            request_id: requestId,
          },
        });

        counters.escalations_resolved += 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        processed_incidents: incidents.length,
        auto_remediation: {
          attempted: counters.auto_attempted,
          success: counters.auto_success,
          failed: counters.auto_failed,
          skipped: counters.auto_skipped,
        },
        escalations: {
          opened: counters.escalations_opened,
          reminders: counters.escalations_reminders,
          resolved: counters.escalations_resolved,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("ops-autopilot error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        request_id: requestId,
        error: asErrorMessage(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
