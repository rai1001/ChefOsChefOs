import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { format, addDays, subDays } from "date-fns";

export interface ProductionTask {
  id: string;
  title: string;
  description: string | null;
  task_date: string;
  shift: string;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  event_id: string | null;
  completed_at: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionTaskWithRelations extends ProductionTask {
  event?: { id: string; name: string; pax: number } | null;
}

export interface ProductionTaskInsert {
  title: string;
  description?: string | null;
  task_date: string;
  shift: string;
  status?: string;
  priority?: string;
  assigned_to?: string | null;
  event_id?: string | null;
}

export function useTasks(options?: { startDate?: string; endDate?: string; shift?: string; status?: string }) {
  const today = new Date();
  const defaultStart = format(subDays(today, 7), "yyyy-MM-dd");
  const defaultEnd = format(addDays(today, 14), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["production_tasks", options?.startDate, options?.endDate, options?.shift, options?.status],
    queryFn: async () => {
      let query = supabase
        .from("production_tasks")
        .select(`
          *,
          event:events(id, name, pax)
        `)
        .gte("task_date", options?.startDate || defaultStart)
        .lte("task_date", options?.endDate || defaultEnd)
        .order("task_date", { ascending: true })
        .order("priority", { ascending: true });

      if (options?.shift && options.shift !== "all") {
        query = query.eq("shift", options.shift);
      }
      if (options?.status && options.status !== "all") {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ProductionTaskWithRelations[];
    },
  });
}

export function useTaskStats() {
  const today = format(new Date(), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["task_stats"],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("production_tasks")
        .select("id, status, completed_at")
        .gte("task_date", today);

      if (error) throw error;

      const pendingCount = tasks?.filter(t => t.status === "pending").length || 0;
      const inProgressCount = tasks?.filter(t => t.status === "in_progress").length || 0;
      const completedTodayCount = tasks?.filter(t => 
        t.status === "completed" && t.completed_at?.startsWith(today)
      ).length || 0;
      const totalTasks = tasks?.length || 0;

      return {
        pendingCount,
        inProgressCount,
        completedTodayCount,
        totalTasks,
      };
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (task: ProductionTaskInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("production_tasks")
        .insert({ ...task, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Tarea creada",
        description: "La tarea se ha añadido correctamente",
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

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ProductionTask> & { id: string }) => {
      const { data, error } = await supabase
        .from("production_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_stats"] });
      toast({
        title: "Tarea actualizada",
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

export function useStartTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("production_tasks")
        .update({ 
          status: "in_progress",
          started_at: new Date().toISOString()
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_stats"] });
      toast({
        title: "Tarea iniciada",
        description: "Se ha iniciado el cronómetro de la tarea",
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

export function useCompleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, started_at }: { id: string; started_at: string | null }) => {
      // Calculate duration if task was started
      let duration_seconds = null;
      if (started_at) {
        const startedDate = new Date(started_at);
        const now = new Date();
        duration_seconds = Math.round((now.getTime() - startedDate.getTime()) / 1000);
      }

      const { data, error } = await supabase
        .from("production_tasks")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString(),
          duration_seconds
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["production_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      
      const duration = data.duration_seconds;
      if (duration) {
        const minutes = Math.floor(duration / 60);
        const seconds = duration % 60;
        toast({
          title: "Tarea completada",
          description: `Duración: ${minutes}m ${seconds}s`,
        });
      } else {
        toast({
          title: "Tarea completada",
        });
      }
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

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("production_tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["production_tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task_stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      toast({
        title: "Tarea eliminada",
        description: "La tarea se ha eliminado",
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
