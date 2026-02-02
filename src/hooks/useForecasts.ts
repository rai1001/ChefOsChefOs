import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { addDays, subDays, format } from "date-fns";

export interface Forecast {
  id: string;
  forecast_date: string;
  hotel_occupancy: number | null;
  breakfast_pax: number | null;
  half_board_pax: number | null;
  full_board_pax: number | null;
  extras_pax: number | null;
  predicted_occupancy: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastInsert {
  forecast_date: string;
  hotel_occupancy?: number | null;
  breakfast_pax?: number | null;
  half_board_pax?: number | null;
  full_board_pax?: number | null;
  extras_pax?: number | null;
  predicted_occupancy?: number | null;
  notes?: string | null;
}

export function useForecasts(options?: { startDate?: string; endDate?: string; days?: number }) {
  const today = new Date();
  const defaultStart = format(today, "yyyy-MM-dd");
  const defaultEnd = format(addDays(today, options?.days || 14), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["forecasts", options?.startDate || defaultStart, options?.endDate || defaultEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forecasts")
        .select("*")
        .gte("forecast_date", options?.startDate || defaultStart)
        .lte("forecast_date", options?.endDate || defaultEnd)
        .order("forecast_date", { ascending: true });

      if (error) throw error;
      return data as Forecast[];
    },
  });
}

export function useUpcomingForecasts(days: number = 7) {
  const today = new Date();
  // Include past 30 days to show recently imported forecasts
  const startDate = format(subDays(today, 30), "yyyy-MM-dd");
  const endDate = format(addDays(today, days), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["forecasts", "upcoming", days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forecasts")
        .select("*")
        .gte("forecast_date", startDate)
        .lte("forecast_date", endDate)
        .order("forecast_date", { ascending: true });

      if (error) throw error;
      return data as Forecast[];
    },
  });
}

export function useCreateForecast() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (forecast: ForecastInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("forecasts")
        .insert({ ...forecast, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      toast({
        title: "Previsión creada",
        description: "La previsión se ha añadido correctamente",
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

export function useUpdateForecast() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Forecast> & { id: string }) => {
      const { data, error } = await supabase
        .from("forecasts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      toast({
        title: "Previsión actualizada",
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

export function useBulkUpsertForecasts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (forecasts: ForecastInsert[]) => {
      if (!forecasts || forecasts.length === 0) return [];

      // Requisito: "quedarse siempre con la última importación".
      // Para evitar acumulados en dashboard, sustituimos por completo la previsión existente.
      const { error: deleteError } = await supabase
        .from("forecasts")
        .delete()
        // PostgREST exige un filtro; esto equivale a borrar todas las filas.
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (deleteError) throw deleteError;

      const { data, error } = await supabase
        .from("forecasts")
        .insert(forecasts)
        .select();

      if (error) throw error;
      return (data || []) as Forecast[];
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Previsión importada",
        description: `Se procesaron ${data.length} días de previsión`,
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
