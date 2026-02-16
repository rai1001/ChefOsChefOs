import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import type { EventStatusNormalized, EventTypeNormalized } from "@/lib/eventNormalization";
import {
  dedupeNormalizedEvents,
  normalizeEventInsert,
  normalizeEventStatus,
  normalizeEventType,
} from "@/lib/eventNormalization";

export interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string | null;
  venue_id: string | null;
  menu_id: string | null;
  pax: number;
  pax_estimated: number;
  pax_confirmed: number;
  event_type: EventTypeNormalized;
  client_name: string | null;
  client_contact: string | null;
  status: EventStatusNormalized | "in_progress" | "completed" | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventWithRelations extends Event {
  venue?: { id: string; name: string; capacity: number | null } | null;
  menu?: { id: string; name: string } | null;
}

export interface EventInsert {
  name: string;
  event_date: string;
  event_time?: string | null;
  venue_id?: string | null;
  menu_id?: string | null;
  pax?: number;
  pax_estimated?: number | null;
  pax_confirmed?: number | null;
  event_type?: string | null;
  client_name?: string | null;
  client_contact?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface EventBaseRow {
  id: string;
  name: string;
  event_date: string;
  event_time: string | null;
  venue_id: string | null;
  menu_id: string | null;
  pax: number | null;
  pax_estimated: number | null;
  pax_confirmed: number | null;
  event_type: string | null;
  client_name: string | null;
  client_contact: string | null;
  status: string | null;
  notes: string | null;
}

function hasOwn<T extends object>(target: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function normalizeEventMutationPayload(input: EventInsert) {
  const normalized = normalizeEventInsert(input);
  if (!normalized) {
    throw new Error("Evento invalido: revisa nombre y fecha.");
  }
  return normalized;
}

export function useEvents(options?: { startDate?: string; endDate?: string }) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["events", hotelId, options?.startDate, options?.endDate],
    queryFn: async () => {
      if (!hotelId) return [];

      let query = supabase
        .from("events")
        .select(`
          *,
          venue:venues(id, name, capacity),
          menu:menus(id, name)
        `)
        .eq("hotel_id", hotelId)
        .order("event_date", { ascending: true });

      if (options?.startDate) {
        query = query.gte("event_date", options.startDate);
      }
      if (options?.endDate) {
        query = query.lte("event_date", options.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EventWithRelations[];
    },
    enabled: !!hotelId,
  });
}

export function useVenues() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["venues", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];

      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });
}

export function useMenus() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["menus", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];

      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (event: EventInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      const normalized = normalizeEventMutationPayload(event);
      const { data, error } = await supabase
        .from("events")
        .insert({
          ...normalized,
          menu_id: event.menu_id ?? null,
          client_name: event.client_name ?? null,
          client_contact: event.client_contact ?? null,
          hotel_id: hotelId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Evento creado",
        description: "El evento se ha anadido correctamente",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Event> & { id: string }) => {
      const { data: currentRow, error: currentError } = await supabase
        .from("events")
        .select(
          "id, name, event_date, event_time, venue_id, menu_id, pax, pax_estimated, pax_confirmed, event_type, client_name, client_contact, status, notes",
        )
        .eq("id", id)
        .single();

      if (currentError) throw currentError;
      const current = currentRow as EventBaseRow;

      const merged: EventInsert = {
        name: hasOwn(updates, "name") ? (updates.name as string) : current.name,
        event_date: hasOwn(updates, "event_date") ? (updates.event_date as string) : current.event_date,
        event_time: hasOwn(updates, "event_time") ? updates.event_time : current.event_time,
        venue_id: hasOwn(updates, "venue_id") ? updates.venue_id : current.venue_id,
        menu_id: hasOwn(updates, "menu_id") ? updates.menu_id : current.menu_id,
        pax: hasOwn(updates, "pax") ? updates.pax ?? undefined : current.pax ?? undefined,
        pax_estimated: hasOwn(updates, "pax_estimated") ? updates.pax_estimated : current.pax_estimated,
        pax_confirmed: hasOwn(updates, "pax_confirmed") ? updates.pax_confirmed : current.pax_confirmed,
        event_type: hasOwn(updates, "event_type") ? updates.event_type : current.event_type,
        client_name: hasOwn(updates, "client_name") ? updates.client_name : current.client_name,
        client_contact: hasOwn(updates, "client_contact") ? updates.client_contact : current.client_contact,
        status: hasOwn(updates, "status") ? updates.status : current.status,
        notes: hasOwn(updates, "notes") ? updates.notes : current.notes,
      };

      const normalized = normalizeEventMutationPayload(merged);

      const { data, error } = await supabase
        .from("events")
        .update({
          ...normalized,
          menu_id: merged.menu_id ?? null,
          client_name: merged.client_name ?? null,
          client_contact: merged.client_contact ?? null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Evento actualizado",
        description: "Los cambios se han guardado",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Evento eliminado",
        description: "El evento se ha eliminado",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useBulkInsertEvents() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (events: EventInsert[]) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      if (!events || events.length === 0) return { inserted: 0, duplicates: 0, rejected: 0 };

      const normalizedRows = events
        .map((event) => normalizeEventInsert(event))
        .filter((event): event is NonNullable<typeof event> => Boolean(event));

      if (normalizedRows.length === 0) {
        throw new Error("No se encontraron filas validas para importar.");
      }

      const deduped = dedupeNormalizedEvents(normalizedRows);

      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("hotel_id", hotelId)
        .is("created_by", null);

      if (deleteError) throw deleteError;

      const rowsToInsert = deduped.rows.map((event) => ({
        ...event,
        hotel_id: hotelId,
      }));

      const { data, error } = await supabase
        .from("events")
        .insert(rowsToInsert)
        .select("id");

      if (error) throw error;

      return {
        inserted: data?.length ?? 0,
        duplicates: deduped.duplicates,
        rejected: Math.max(events.length - normalizedRows.length, 0),
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
      toast({
        title: "Eventos importados",
        description:
          `Insertados ${result.inserted}. ` +
          `Duplicados fusionados: ${result.duplicates}. ` +
          `Filas invalidas: ${result.rejected}.`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error al importar",
        description: error.message,
      });
    },
  });
}

export { normalizeEventStatus, normalizeEventType };
