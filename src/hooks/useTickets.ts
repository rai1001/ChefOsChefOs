import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  sanitizeTicketAttachments,
  sanitizeTicketMetadata,
  sanitizeTicketText,
  type TicketAttachment,
  type TicketCategory,
  type TicketPriority,
  type TicketSeverity,
  type TicketSource,
  type TicketStatus,
} from "@/lib/ticketing";
import { captureRuntimeError } from "@/lib/runtimeErrorLogger";

const supabaseUntyped = supabase as unknown as SupabaseClient;

export interface SupportTicket {
  id: string;
  ticket_id: string;
  hotel_id: string;
  title: string;
  description: string;
  category: TicketCategory;
  severity: TicketSeverity;
  priority: TicketPriority;
  status: TicketStatus;
  source: TicketSource;
  requester_id: string | null;
  requester_name: string;
  assignee_user_id: string | null;
  attachments: TicketAttachment[];
  metadata: Record<string, unknown>;
  first_response_at: string | null;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicketEvent {
  id: string;
  hotel_id: string;
  ticket_id: string;
  event_id: string;
  event_type:
    | "created"
    | "updated"
    | "status_changed"
    | "assigned"
    | "note"
    | "closed"
    | "reopened"
    | "callback_received"
    | "callback_processed"
    | "callback_ignored"
    | "dispatched"
    | "dispatch_failed";
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  payload: Record<string, unknown>;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_type: "user" | "system" | "openclaw";
  source: "ui" | "api" | "webhook" | "operations" | "system";
  created_at: string;
}

export interface TicketFilters {
  status?: TicketStatus | "all";
  severity?: TicketSeverity | "all";
  priority?: TicketPriority | "all";
  fromDate?: string;
  toDate?: string;
  requester?: string;
  search?: string;
  onlyReceived?: boolean;
}

export interface TicketMetrics {
  tickets_created_today: number;
  avg_first_response_minutes: number | null;
  avg_resolution_minutes: number | null;
  tickets_by_severity: Record<string, number>;
  tickets_by_status: Record<string, number>;
}

export interface TicketBridgeHealth {
  bridge_status: "up" | "degraded" | "down";
  success_count_30m: number;
  error_count_30m: number;
  pending_due: number;
  failed_count: number;
  last_success_at: string | null;
  last_error_at: string | null;
}

export interface TicketAssignee {
  staff_id: string;
  user_id: string;
  full_name: string;
  role: string;
}

function normalizeTicketRow(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    ticket_id: String(row.ticket_id),
    hotel_id: String(row.hotel_id),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    category: String(row.category ?? "soporte") as TicketCategory,
    severity: String(row.severity ?? "medium") as TicketSeverity,
    priority: String(row.priority ?? "P3") as TicketPriority,
    status: String(row.status ?? "received") as TicketStatus,
    source: String(row.source ?? "web") as TicketSource,
    requester_id: (row.requester_id as string | null) ?? null,
    requester_name: String(row.requester_name ?? "Solicitante"),
    assignee_user_id: (row.assignee_user_id as string | null) ?? null,
    attachments: sanitizeTicketAttachments(row.attachments),
    metadata: sanitizeTicketMetadata(row.metadata),
    first_response_at: (row.first_response_at as string | null) ?? null,
    resolved_at: (row.resolved_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

async function dispatchTicketOutbox(hotelId: string) {
  try {
    await supabase.functions.invoke("openclaw-ticket-dispatch", {
      body: {
        hotel_id: hotelId,
        max_batch: 20,
      },
    });
  } catch (error) {
    void captureRuntimeError("mutation_error", error, {
      source: "dispatch_ticket_outbox",
      hotelId,
    });
  }
}

function toIsoStart(date: string) {
  return `${date}T00:00:00.000Z`;
}

function toIsoEnd(date: string) {
  return `${date}T23:59:59.999Z`;
}

export function useTickets(filters?: TicketFilters) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["support_tickets", hotelId, filters],
    enabled: !!hotelId,
    queryFn: async () => {
      if (!hotelId) return [] as SupportTicket[];

      let query = supabaseUntyped
        .from("support_tickets")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("updated_at", { ascending: false })
        .limit(400);

      if (filters?.onlyReceived) {
        query = query.eq("status", "received");
      } else if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }

      if (filters?.severity && filters.severity !== "all") {
        query = query.eq("severity", filters.severity);
      }

      if (filters?.priority && filters.priority !== "all") {
        query = query.eq("priority", filters.priority);
      }

      if (filters?.fromDate) {
        query = query.gte("created_at", toIsoStart(filters.fromDate));
      }

      if (filters?.toDate) {
        query = query.lte("created_at", toIsoEnd(filters.toDate));
      }

      if (filters?.requester?.trim()) {
        query = query.ilike("requester_name", `%${filters.requester.trim()}%`);
      }

      if (filters?.search?.trim()) {
        const search = filters.search.trim();
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,ticket_id.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row) => normalizeTicketRow(row as Record<string, unknown>));
    },
  });
}

export function useTicket(ticketId: string | null) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["support_ticket", hotelId, ticketId],
    enabled: !!hotelId && !!ticketId,
    queryFn: async () => {
      if (!hotelId || !ticketId) return null;

      const { data, error } = await supabaseUntyped
        .from("support_tickets")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("id", ticketId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return normalizeTicketRow(data as Record<string, unknown>);
    },
  });
}

export function useTicketEvents(ticketId: string | null) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["support_ticket_events", hotelId, ticketId],
    enabled: !!hotelId && !!ticketId,
    queryFn: async () => {
      if (!hotelId || !ticketId) return [] as SupportTicketEvent[];

      const { data, error } = await supabaseUntyped
        .from("support_ticket_events")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id),
        hotel_id: String(row.hotel_id),
        ticket_id: String(row.ticket_id),
        event_id: String(row.event_id),
        event_type: String(row.event_type) as SupportTicketEvent["event_type"],
        from_status: (row.from_status as string | null) ?? null,
        to_status: (row.to_status as string | null) ?? null,
        note: (row.note as string | null) ?? null,
        payload: sanitizeTicketMetadata(row.payload),
        actor_user_id: (row.actor_user_id as string | null) ?? null,
        actor_name: (row.actor_name as string | null) ?? null,
        actor_type: String(row.actor_type ?? "user") as SupportTicketEvent["actor_type"],
        source: String(row.source ?? "ui") as SupportTicketEvent["source"],
        created_at: String(row.created_at),
      }));
    },
  });
}

export function useTicketMetrics() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["support_ticket_metrics", hotelId],
    enabled: !!hotelId,
    queryFn: async (): Promise<TicketMetrics | null> => {
      if (!hotelId) return null;

      const { data, error } = await supabaseUntyped
        .from("support_ticket_metrics_view")
        .select("*")
        .eq("hotel_id", hotelId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        tickets_created_today: Number(data.tickets_created_today ?? 0),
        avg_first_response_minutes:
          data.avg_first_response_minutes === null
            ? null
            : Number(data.avg_first_response_minutes),
        avg_resolution_minutes:
          data.avg_resolution_minutes === null
            ? null
            : Number(data.avg_resolution_minutes),
        tickets_by_severity: sanitizeTicketMetadata(data.tickets_by_severity) as Record<string, number>,
        tickets_by_status: sanitizeTicketMetadata(data.tickets_by_status) as Record<string, number>,
      };
    },
  });
}

export function useTicketBridgeHealth() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["support_ticket_bridge_health", hotelId],
    enabled: !!hotelId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<TicketBridgeHealth | null> => {
      if (!hotelId) return null;

      const { data, error } = await supabaseUntyped
        .from("support_ticket_bridge_health_view")
        .select("*")
        .eq("hotel_id", hotelId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        bridge_status: String(data.bridge_status ?? "degraded") as TicketBridgeHealth["bridge_status"],
        success_count_30m: Number(data.success_count_30m ?? 0),
        error_count_30m: Number(data.error_count_30m ?? 0),
        pending_due: Number(data.pending_due ?? 0),
        failed_count: Number(data.failed_count ?? 0),
        last_success_at: (data.last_success_at as string | null) ?? null,
        last_error_at: (data.last_error_at as string | null) ?? null,
      };
    },
  });
}

export function useTicketAssignees() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["support_ticket_assignees", hotelId],
    enabled: !!hotelId,
    queryFn: async (): Promise<TicketAssignee[]> => {
      if (!hotelId) return [];

      const { data, error } = await supabaseUntyped
        .from("staff")
        .select("id, user_id, full_name, role, status")
        .eq("hotel_id", hotelId)
        .eq("status", "active")
        .not("user_id", "is", null)
        .order("full_name", { ascending: true });

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
        staff_id: String(row.id),
        user_id: String(row.user_id),
        full_name: String(row.full_name ?? "Sin nombre"),
        role: String(row.role ?? "staff"),
      }));
    },
  });
}

function ticketMutationInvalidations(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["support_tickets"] });
  queryClient.invalidateQueries({ queryKey: ["support_ticket"] });
  queryClient.invalidateQueries({ queryKey: ["support_ticket_events"] });
  queryClient.invalidateQueries({ queryKey: ["support_ticket_metrics"] });
  queryClient.invalidateQueries({ queryKey: ["support_ticket_bridge_health"] });
}

export function useCreateTicket() {
  const hotelId = useCurrentHotelId();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      title: string;
      description: string;
      category: TicketCategory;
      severity: TicketSeverity;
      priority: TicketPriority;
      source: TicketSource;
      requesterName?: string;
      attachments?: unknown;
      metadata?: Record<string, unknown>;
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const row = {
        hotel_id: hotelId,
        title: sanitizeTicketText(payload.title, 240),
        description: sanitizeTicketText(payload.description, 8000),
        category: payload.category,
        severity: payload.severity,
        priority: payload.priority,
        status: "received" as TicketStatus,
        source: payload.source,
        requester_id: user?.id ?? null,
        requester_name: sanitizeTicketText(
          payload.requesterName ?? profile?.full_name ?? "Solicitante",
          120,
        ),
        attachments: sanitizeTicketAttachments(payload.attachments),
        metadata: sanitizeTicketMetadata(payload.metadata),
        created_by: user?.id ?? null,
      };

      const { data, error } = await supabaseUntyped
        .from("support_tickets")
        .insert(row)
        .select("*")
        .single();

      if (error) throw error;

      await dispatchTicketOutbox(hotelId);
      return normalizeTicketRow(data as Record<string, unknown>);
    },
    onSuccess: () => {
      ticketMutationInvalidations(queryClient);
      toast({ title: "Ticket creado", description: "Se registro y se emitio al bridge OpenClaw." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useUpdateTicket() {
  const hotelId = useCurrentHotelId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      ticketId: string;
      updates: Partial<{
        title: string;
        description: string;
        category: TicketCategory;
        severity: TicketSeverity;
        priority: TicketPriority;
        source: TicketSource;
        status: TicketStatus;
        requester_name: string;
        assignee_user_id: string | null;
        attachments: unknown;
        metadata: Record<string, unknown>;
      }>;
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const updates: Record<string, unknown> = {};
      if (payload.updates.title !== undefined) updates.title = sanitizeTicketText(payload.updates.title, 240);
      if (payload.updates.description !== undefined) updates.description = sanitizeTicketText(payload.updates.description, 8000);
      if (payload.updates.category !== undefined) updates.category = payload.updates.category;
      if (payload.updates.severity !== undefined) updates.severity = payload.updates.severity;
      if (payload.updates.priority !== undefined) updates.priority = payload.updates.priority;
      if (payload.updates.source !== undefined) updates.source = payload.updates.source;
      if (payload.updates.status !== undefined) updates.status = payload.updates.status;
      if (payload.updates.requester_name !== undefined) updates.requester_name = sanitizeTicketText(payload.updates.requester_name, 120);
      if (payload.updates.assignee_user_id !== undefined) updates.assignee_user_id = payload.updates.assignee_user_id;
      if (payload.updates.attachments !== undefined) updates.attachments = sanitizeTicketAttachments(payload.updates.attachments);
      if (payload.updates.metadata !== undefined) updates.metadata = sanitizeTicketMetadata(payload.updates.metadata);

      const { data, error } = await supabaseUntyped
        .from("support_tickets")
        .update(updates)
        .eq("hotel_id", hotelId)
        .eq("id", payload.ticketId)
        .select("*")
        .single();

      if (error) throw error;

      await dispatchTicketOutbox(hotelId);
      return normalizeTicketRow(data as Record<string, unknown>);
    },
    onSuccess: () => {
      ticketMutationInvalidations(queryClient);
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useSetTicketStatus() {
  const update = useUpdateTicket();

  return useMutation({
    mutationFn: async (payload: { ticketId: string; status: TicketStatus }) => {
      return update.mutateAsync({
        ticketId: payload.ticketId,
        updates: { status: payload.status },
      });
    },
  });
}

export function useAssignTicket() {
  const update = useUpdateTicket();

  return useMutation({
    mutationFn: async (payload: { ticketId: string; assigneeUserId: string | null }) => {
      return update.mutateAsync({
        ticketId: payload.ticketId,
        updates: { assignee_user_id: payload.assigneeUserId },
      });
    },
  });
}

export function useAddTicketNote() {
  const hotelId = useCurrentHotelId();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: { ticketId: string; note: string }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const note = sanitizeTicketText(payload.note, 4000);
      if (!note) throw new Error("La nota no puede estar vacia");

      const { error } = await supabaseUntyped.from("support_ticket_events").insert({
        hotel_id: hotelId,
        ticket_id: payload.ticketId,
        event_id: `tev_note_${crypto.randomUUID().replaceAll("-", "")}`,
        event_type: "note",
        note,
        payload: {},
        actor_user_id: user?.id ?? null,
        actor_name: profile?.full_name ?? null,
        actor_type: "user",
        source: "ui",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support_ticket_events"] });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}

export function useReceivedTicketsInbox() {
  const query = useTickets({ onlyReceived: true });

  const byPriority = useMemo(() => {
    const list = query.data ?? [];
    return [...list].sort((a, b) => {
      const order: Record<TicketPriority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
      if (order[a.priority] !== order[b.priority]) {
        return order[a.priority] - order[b.priority];
      }
      return b.created_at.localeCompare(a.created_at);
    });
  }, [query.data]);

  return {
    ...query,
    data: byPriority,
  };
}

export function useDispatchTicketBridge() {
  const hotelId = useCurrentHotelId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload?: { maxBatch?: number }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const { data, error } = await supabase.functions.invoke("openclaw-ticket-dispatch", {
        body: {
          hotel_id: hotelId,
          max_batch: payload?.maxBatch ?? 20,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support_ticket_bridge_health"] });
      toast({ title: "Bridge ejecutado", description: "Se proceso la cola de salida hacia OpenClaw." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    },
  });
}
