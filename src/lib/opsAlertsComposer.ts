export interface OpsAlertsInput {
  criticalStockCount: number;
  urgentPurchaseCount: number;
  overdueTaskCount: number;
  eventsWithoutMenuCount: number;
}

export interface OpsAlert {
  key: string;
  severity: "critical" | "warning";
  message: string;
}

export function composeOpsAlerts(input: OpsAlertsInput): OpsAlert[] {
  const alerts: OpsAlert[] = [];

  if (input.criticalStockCount > 0) {
    alerts.push({
      key: "critical_stock",
      severity: "critical",
      message: `${input.criticalStockCount} productos con stock crítico`,
    });
  }

  if (input.urgentPurchaseCount > 0) {
    alerts.push({
      key: "urgent_purchases",
      severity: "warning",
      message: `${input.urgentPurchaseCount} pedidos urgentes por emitir`,
    });
  }

  if (input.overdueTaskCount > 0) {
    alerts.push({
      key: "overdue_tasks",
      severity: "critical",
      message: `${input.overdueTaskCount} tareas vencidas`,
    });
  }

  if (input.eventsWithoutMenuCount > 0) {
    alerts.push({
      key: "events_without_menu",
      severity: "warning",
      message: `${input.eventsWithoutMenuCount} eventos sin menú asignado`,
    });
  }

  return alerts;
}
