import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export interface Event {
  id: string;
  name: string;
  event_date: string;
  event_time: string | null;
  venue_id: string | null;
  menu_id: string | null;
  pax: number;
  client_name: string | null;
  client_contact: string | null;
  status: string | null;
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
  client_name?: string | null;
  client_contact?: string | null;
  status?: string;
  notes?: string | null;
}

export function useEvents(options?: { startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ["events", options?.startDate, options?.endDate],
    queryFn: async () => {
      let query = supabase
        .from("events")
        .select(`
          *,
          venue:venues(id, name, capacity),
          menu:menus(id, name)
        `)
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
  });
}

export function useVenues() {
  return useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useMenus() {
  return useQuery({
    queryKey: ["menus"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (event: EventInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("events")
        .insert({ ...event, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Evento creado",
        description: "El evento se ha añadido correctamente",
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
      const { data, error } = await supabase
        .from("events")
        .update(updates)
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

      // Delete only previously-imported events (created_by IS NULL) for this hotel.
      // This keeps manually-created events intact.
      const { error: deleteError } = await supabase
        .from("events")
        .delete()
        .eq("hotel_id", hotelId)
        .is("created_by", null);

      if (deleteError) throw deleteError;

      // Add hotel_id to each event
      const eventsWithHotel = events.map(e => ({
        ...e,
        hotel_id: hotelId,
      }));

      const { data, error } = await supabase
        .from("events")
        .insert(eventsWithHotel)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["upcoming-events"] });
      toast({
        title: "Eventos importados",
        description: `Se reemplazaron por ${data.length} eventos correctamente`,
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
