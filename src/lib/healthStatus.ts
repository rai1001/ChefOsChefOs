export type HealthLevel = "healthy" | "warning" | "critical" | "unknown";

export interface HealthSignal {
  key: "system" | "sync" | "jobs" | "errors" | "backup";
  label: string;
  status: HealthLevel;
  detail: string;
  metric?: string;
  updatedAt?: string | null;
}

export function getHealthTone(status: HealthLevel) {
  switch (status) {
    case "healthy":
      return "border-success/30 bg-success/10 text-success";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning";
    case "critical":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export function getHealthLabel(status: HealthLevel) {
  switch (status) {
    case "healthy":
      return "OK";
    case "warning":
      return "Atención";
    case "critical":
      return "Crítico";
    default:
      return "Sin datos";
  }
}

export function combineHealth(signals: HealthSignal[]): HealthLevel {
  if (signals.some((signal) => signal.status === "critical")) return "critical";
  if (signals.some((signal) => signal.status === "warning")) return "warning";
  if (signals.some((signal) => signal.status === "unknown")) return "unknown";
  return "healthy";
}
