import { addDays, format, isToday, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router-dom";
import { CalendarClock, CheckCircle2, Clock3, Loader2, Play } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useMyShiftSnapshot } from "@/hooks/useMyShiftSnapshot";
import { useCompleteTask, useStartTask, useTasks } from "@/hooks/useTasks";

function shiftLabel(shiftType: string | null) {
  if (!shiftType) return "Sin turno";
  if (shiftType === "morning") return "Manana";
  if (shiftType === "afternoon") return "Tarde";
  if (shiftType === "night") return "Noche";
  return shiftType;
}

function statusLabel(status: string | null) {
  if (status === "in_progress") return "En curso";
  if (status === "completed") return "Completada";
  if (status === "cancelled") return "Cancelada";
  return "Pendiente";
}

const MyShift = () => {
  const { user, hasManagementAccess, hasRole } = useAuth();
  const canCreateTask = hasManagementAccess() || hasRole("super_admin");

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const endDate = format(addDays(today, 7), "yyyy-MM-dd");

  const myShiftQuery = useMyShiftSnapshot({ days: 7 });
  const tasksQuery = useTasks({
    startDate: todayStr,
    endDate,
    assignedTo: user?.id,
  });

  const startTask = useStartTask();
  const completeTask = useCompleteTask();

  const tasks = tasksQuery.data ?? [];
  const todayTasks = tasks.filter((task) => task.task_date === todayStr && task.status !== "completed");
  const upcomingTasks = tasks
    .filter((task) => task.task_date !== todayStr && task.status !== "completed")
    .slice(0, 8);

  if (myShiftQuery.isLoading || tasksQuery.isLoading) {
    return (
      <MainLayout title="Mi turno" subtitle="Mi turno + mis tareas">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <Skeleton className="h-56 rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
          <div className="flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        </div>
      </MainLayout>
    );
  }

  const todayShift = myShiftQuery.data?.todayShift;
  const linkedStaff = myShiftQuery.data?.linkedStaff;
  const upcomingShifts = (myShiftQuery.data?.upcomingShifts ?? []).slice(0, 5);

  return (
    <MainLayout title="Mi turno" subtitle="Operacion personal diaria">
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Turno de hoy</p>
            <p className="mt-1 font-display text-2xl font-semibold">{shiftLabel(todayShift?.shift_type ?? null)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {todayShift ? `${todayShift.start_time?.slice(0, 5) ?? "--:--"} - ${todayShift.end_time?.slice(0, 5) ?? "--:--"}` : "Sin asignacion hoy"}
            </p>
            {linkedStaff && (
              <Badge variant="outline" className="mt-3">
                {linkedStaff.full_name} - {linkedStaff.role}
              </Badge>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Mis tareas hoy</p>
            <p className="mt-1 font-display text-2xl font-semibold">{todayTasks.length}</p>
            <p className="text-xs text-muted-foreground mt-1">{tasks.filter((task) => task.status === "in_progress").length} en curso</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm text-muted-foreground">Proximos turnos (7d)</p>
            <p className="mt-1 font-display text-2xl font-semibold">{upcomingShifts.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Visibilidad operativa sin cambiar pantalla</p>
          </div>
        </div>

        {!linkedStaff && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
            No tienes ficha de personal vinculada a tu usuario. RRHH debe completar el campo <code>user_id</code> en Personal para mostrar turnos personalizados.
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border p-4">
            <h3 className="font-display text-lg font-semibold">Mis tareas de hoy</h3>
            <div className="flex items-center gap-2">
              {canCreateTask && (
                <Button asChild size="sm" variant="outline">
                  <Link to="/tasks?quick=new-task&service=breakfast">Crear tarea rapida</Link>
                </Button>
              )}
              <Button asChild size="sm">
                <Link to="/tasks">Ver modulo tareas</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-2 p-4">
            {todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes tareas pendientes para hoy.</p>
            ) : (
              todayTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground">{shiftLabel(task.shift)} - {statusLabel(task.status)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {task.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => startTask.mutate(task.id)} disabled={startTask.isPending}>
                          <Play className="mr-1 h-3.5 w-3.5" />
                          Iniciar
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <Button
                          size="sm"
                          onClick={() => completeTask.mutate({ id: task.id, started_at: task.started_at })}
                          disabled={completeTask.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Completar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">Proximos turnos</h3>
            </div>
            <div className="space-y-2 p-4">
              {upcomingShifts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin turnos asignados en los proximos 7 dias.</p>
              ) : (
                upcomingShifts.map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                    <div>
                      <p className="text-sm font-medium">
                        {isToday(parseISO(shift.shift_date)) ? "Hoy" : format(parseISO(shift.shift_date), "EEE d MMM", { locale: es })}
                      </p>
                      <p className="text-xs text-muted-foreground">{shiftLabel(shift.shift_type)}</p>
                    </div>
                    <Badge variant="outline">
                      {shift.start_time?.slice(0, 5) ?? "--:--"} - {shift.end_time?.slice(0, 5) ?? "--:--"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border p-4">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">Tareas proximas</h3>
            </div>
            <div className="space-y-2 p-4">
              {upcomingTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin tareas asignadas para los proximos dias.</p>
              ) : (
                upcomingTasks.map((task) => (
                  <div key={task.id} className="rounded-lg border border-border p-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(task.task_date), "EEE d MMM", { locale: es })} - {shiftLabel(task.shift)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default MyShift;
