import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Play, 
  CheckCircle2, 
  Clock,
  Flame,
  Calendar,
  Edit2,
  Trash2,
  Loader2
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import {
  useTasks,
  useTaskStats,
  useCreateTask,
  useUpdateTask,
  useStartTask,
  useCompleteTask,
  useDeleteTask,
  ProductionTaskWithRelations,
} from "@/hooks/useTasks";
import { useEvents } from "@/hooks/useEvents";

const Tasks = () => {
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProductionTaskWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    task_date: format(new Date(), "yyyy-MM-dd"),
    shift: "morning",
    priority: "medium",
    event_id: "",
  });

  const { data: tasks = [], isLoading } = useTasks({
    shift: shiftFilter,
    status: statusFilter,
  });
  const { data: stats } = useTaskStats();
  const { data: events = [] } = useEvents({
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
  });

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const startTask = useStartTask();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  useEffect(() => {
    const quick = searchParams.get("quick");
    if (!quick) return;

    if (quick === "new-task") {
      setFormData({
        title: "",
        description: "",
        task_date: format(new Date(), "yyyy-MM-dd"),
        shift: "morning",
        priority: "medium",
        event_id: "",
      });
      setIsCreateOpen(true);
    }

    if (quick === "start") {
      const candidate = tasks.find((task) => task.status === "pending");
      if (candidate) void startTask.mutateAsync(candidate.id);
    }

    if (quick === "complete") {
      const candidate = tasks.find((task) => task.status === "in_progress");
      if (candidate) {
        void completeTask.mutateAsync({
          id: candidate.id,
          started_at: candidate.started_at,
        });
      }
    }

    const next = new URLSearchParams(searchParams);
    next.delete("quick");
    setSearchParams(next, { replace: true });
  }, [tasks, searchParams, setSearchParams, startTask, completeTask]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return "Hoy";
    if (isTomorrow(date)) return "Mañana";
    return format(date, "EEEE d", { locale: es });
  };

  // Group tasks by date
  const groupedTasks = tasks.reduce((acc, task) => {
    const dateLabel = getDateLabel(task.task_date);
    if (!acc[dateLabel]) acc[dateLabel] = [];
    acc[dateLabel].push(task);
    return acc;
  }, {} as Record<string, ProductionTaskWithRelations[]>);

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      task_date: format(new Date(), "yyyy-MM-dd"),
      shift: "morning",
      priority: "medium",
      event_id: "",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (task: ProductionTaskWithRelations) => {
    setFormData({
      title: task.title,
      description: task.description || "",
      task_date: task.task_date,
      shift: task.shift,
      priority: task.priority || "medium",
      event_id: task.event_id || "",
    });
    setEditingTask(task);
  };

  const handleSubmit = async () => {
    const data = {
      title: formData.title,
      description: formData.description || null,
      task_date: formData.task_date,
      shift: formData.shift,
      priority: formData.priority,
      event_id: formData.event_id || null,
    };

    if (editingTask) {
      await updateTask.mutateAsync({ id: editingTask.id, ...data });
      setEditingTask(null);
    } else {
      await createTask.mutateAsync(data);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteTask.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <MainLayout 
      title="Tareas de Producción" 
      subtitle="Gestión de tareas por turno y fecha"
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="font-display text-2xl font-semibold mt-1">{stats?.pendingCount || 0}</p>
        </div>
        <div className="rounded-xl border border-info/30 bg-info/5 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">En curso</p>
          <p className="font-display text-2xl font-semibold mt-1 text-info">{stats?.inProgressCount || 0}</p>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Completadas hoy</p>
          <p className="font-display text-2xl font-semibold mt-1 text-success">{stats?.completedTodayCount || 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total tareas</p>
          <p className="font-display text-2xl font-semibold mt-1">{stats?.totalTasks || 0}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={shiftFilter} onValueChange={setShiftFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Turno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos turnos</SelectItem>
              <SelectItem value="morning">Mañana</SelectItem>
              <SelectItem value="afternoon">Tarde</SelectItem>
              <SelectItem value="night">Noche</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="in_progress">En curso</SelectItem>
              <SelectItem value="completed">Completadas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" className="h-9" onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Tarea
        </Button>
      </div>

      {/* Tasks by Date */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : Object.keys(groupedTasks).length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-muted-foreground">
              {tasks.length === 0 ? "No hay tareas programadas" : "No hay tareas con los filtros seleccionados"}
            </p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([dateLabel, dateTasks]) => (
            <div key={dateLabel}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-display text-lg font-semibold capitalize">{dateLabel}</h3>
                <Badge variant="secondary" className="text-xs">{dateTasks.length}</Badge>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dateTasks.map((task, index) => (
                  <div 
                    key={task.id}
                    className={cn(
                      "rounded-xl border bg-card p-4 shadow-sm transition-all animate-fade-in",
                      task.status === "in_progress" && "border-info/30 bg-info/5",
                      task.status === "completed" && "border-success/30 bg-success/5 opacity-75",
                      task.priority === "high" && task.status === "pending" && "border-destructive/20"
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {task.priority === "high" && task.status !== "completed" && (
                            <Flame className="h-4 w-4 text-destructive flex-shrink-0" />
                          )}
                          <h4 className={cn(
                            "font-medium truncate",
                            task.status === "completed" && "line-through text-muted-foreground"
                          )}>
                            {task.title}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {task.shift === "morning" ? "Mañana" : task.shift === "afternoon" ? "Tarde" : "Noche"}
                          </Badge>
                          {task.event && (
                            <Badge variant="secondary" className="text-xs">
                              {task.event.name} ({task.event.pax} pax)
                            </Badge>
                          )}
                          {task.duration_seconds && task.status === "completed" && (
                            <Badge variant="outline" className="text-xs bg-success/10 text-success">
                              {Math.floor(task.duration_seconds / 60)}m {task.duration_seconds % 60}s
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      {/* Status Icon */}
                      {task.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                      ) : task.status === "in_progress" ? (
                        <div className="h-5 w-5 rounded-full border-2 border-info border-t-transparent animate-spin" />
                      ) : (
                        <Clock className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      {task.status === "pending" && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 h-8 text-xs"
                          onClick={() => startTask.mutate(task.id)}
                          disabled={startTask.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      {task.status === "in_progress" && (
                        <Button 
                          size="sm" 
                          className="flex-1 h-8 text-xs bg-success hover:bg-success/90"
                          onClick={() => completeTask.mutate({ id: task.id, started_at: task.started_at })}
                          disabled={completeTask.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completar
                        </Button>
                      )}
                      {task.status !== "completed" && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(task)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive"
                            onClick={() => setDeleteId(task.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingTask} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingTask(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTask ? "Editar Tarea" : "Nueva Tarea"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Modifica los datos de la tarea" : "Crea una nueva tarea de producción"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Preparar entrantes..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalles de la tarea..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="task_date">Fecha *</Label>
                <Input
                  id="task_date"
                  type="date"
                  value={formData.task_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, task_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="shift">Turno *</Label>
                <Select 
                  value={formData.shift} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, shift: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Mañana</SelectItem>
                    <SelectItem value="afternoon">Tarde</SelectItem>
                    <SelectItem value="night">Noche</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Prioridad</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="event">Evento asociado</Label>
                <Select 
                  value={formData.event_id || "none"} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, event_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} ({format(parseISO(e.event_date), "d MMM", { locale: es })})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingTask(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.title || !formData.task_date || createTask.isPending || updateTask.isPending}
            >
              {(createTask.isPending || updateTask.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingTask ? "Guardar cambios" : "Crear tarea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la tarea permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTask.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Tasks;
