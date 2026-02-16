export type TaskServiceType = "breakfast" | "event";
export type TaskShiftType = "morning" | "afternoon" | "night";
export type TaskPriorityType = "low" | "medium" | "high" | "urgent";

export interface TaskServiceTemplate {
  id: string;
  serviceType: TaskServiceType;
  name: string;
  title: string;
  description: string;
  shift: TaskShiftType;
  priority: TaskPriorityType;
}

export const TASK_SERVICE_LABELS: Record<TaskServiceType, string> = {
  breakfast: "Desayuno",
  event: "Evento",
};

export const TASK_SERVICE_TEMPLATES: TaskServiceTemplate[] = [
  {
    id: "breakfast-mise-en-place",
    serviceType: "breakfast",
    name: "Mise en place",
    title: "Mise en place desayuno",
    description: "Preparar estaciones, vajilla, panaderia y reposicion base para servicio de desayuno.",
    shift: "morning",
    priority: "high",
  },
  {
    id: "breakfast-hot-line",
    serviceType: "breakfast",
    name: "Linea caliente",
    title: "Linea caliente desayuno",
    description: "Coordinar produccion de huevos, salchichas y reposicion caliente por picos de demanda.",
    shift: "morning",
    priority: "medium",
  },
  {
    id: "breakfast-closing",
    serviceType: "breakfast",
    name: "Cierre servicio",
    title: "Cierre y merma desayuno",
    description: "Cerrar servicio, registrar merma y traspasar pendientes al siguiente turno.",
    shift: "afternoon",
    priority: "medium",
  },
  {
    id: "event-cold-prep",
    serviceType: "event",
    name: "Preproduccion frio",
    title: "Preproduccion frio evento",
    description: "Montar bases frias, salsas y guarniciones segun pax confirmado del evento.",
    shift: "morning",
    priority: "high",
  },
  {
    id: "event-pass-coordination",
    serviceType: "event",
    name: "Coordinacion pase",
    title: "Coordinacion de pase evento",
    description: "Sincronizar pase con sala y controlar tiempos por bloque del menu del evento.",
    shift: "afternoon",
    priority: "high",
  },
  {
    id: "event-closing",
    serviceType: "event",
    name: "Cierre evento",
    title: "Cierre operativo evento",
    description: "Validar incidencias, merma y limpieza final al cerrar el evento.",
    shift: "night",
    priority: "medium",
  },
];

export function getTaskTemplatesByService(serviceType: TaskServiceType) {
  return TASK_SERVICE_TEMPLATES.filter((template) => template.serviceType === serviceType);
}

export function getTaskTemplateById(templateId: string | null | undefined) {
  if (!templateId) return null;
  return TASK_SERVICE_TEMPLATES.find((template) => template.id === templateId) ?? null;
}

export function getDefaultTemplateForService(serviceType: TaskServiceType) {
  return getTaskTemplatesByService(serviceType)[0] ?? null;
}
