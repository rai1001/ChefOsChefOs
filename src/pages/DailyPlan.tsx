import { useState } from "react";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useDailyPlan } from "@/hooks/useDailyPlan";

const shiftLabel: Record<string, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  night: "Noche",
};

const DailyPlan = () => {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data, isLoading } = useDailyPlan(selectedDate);

  return (
    <MainLayout
      title="Plan Diario"
      subtitle="Programación automática por turnos (motor determinista)"
    >
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <label htmlFor="daily-plan-date" className="text-sm text-muted-foreground">
            Fecha
          </label>
          <Input
            id="daily-plan-date"
            type="date"
            className="mt-2 w-56"
            value={selectedDate}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="font-display text-lg font-semibold mb-3">Bloques planificados</h2>
              {data?.plan.tasks.length ? (
                <div className="space-y-2">
                  {data.plan.tasks.map((task) => (
                    <div
                      key={task.taskId}
                      className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.durationMinutes} min · Responsable {task.assignedTo ?? "sin asignar"}
                        </p>
                      </div>
                      <Badge variant="outline">{shiftLabel[task.shift] ?? task.shift}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin tareas planificadas para este día.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <h2 className="font-display text-lg font-semibold mb-3">Pendientes de capacidad</h2>
              {data?.plan.unplannedTaskIds.length ? (
                <div className="flex flex-wrap gap-2">
                  {data.plan.unplannedTaskIds.map((taskId) => (
                    <Badge key={taskId} variant="secondary">
                      {taskId}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No hay pendientes por capacidad/dependencias.
                </p>
              )}
            </div>

            {data?.aiBriefing && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h2 className="font-display text-lg font-semibold mb-3">Resumen IA (opcional)</h2>
                <Separator className="mb-3" />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.aiBriefing}</p>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default DailyPlan;
