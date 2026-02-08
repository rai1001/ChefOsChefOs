import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  useAlertSubscriptions,
  useUpsertAlertSubscription,
} from "@/hooks/useAlertSubscriptions";
import { Loader2 } from "lucide-react";

export function AlertSubscriptionsSettings() {
  const { data: subscriptions = [], isLoading } = useAlertSubscriptions();
  const upsert = useUpsertAlertSubscription();

  const daily = subscriptions.find((item) => item.frequency === "daily");
  const weekly = subscriptions.find((item) => item.frequency === "weekly");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Alertas Operativas
        </h2>
        <p className="text-sm text-muted-foreground">
          Suscripciones por email para stock crítico, tareas vencidas y eventos sin menú.
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <div>
            <Label htmlFor="ops-alert-daily" className="font-medium">
              Resumen diario
            </Label>
            <p className="text-xs text-muted-foreground">
              Envío diario de alertas operativas.
            </p>
          </div>
          <Switch
            id="ops-alert-daily"
            checked={daily?.enabled ?? false}
            disabled={upsert.isPending}
            onCheckedChange={(enabled) =>
              upsert.mutate({ frequency: "daily", enabled, sendAt: daily?.send_at ?? "07:00" })
            }
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
          <div>
            <Label htmlFor="ops-alert-weekly" className="font-medium">
              Resumen semanal
            </Label>
            <p className="text-xs text-muted-foreground">
              Envío semanal consolidado (lunes por defecto).
            </p>
          </div>
          <Switch
            id="ops-alert-weekly"
            checked={weekly?.enabled ?? false}
            disabled={upsert.isPending}
            onCheckedChange={(enabled) =>
              upsert.mutate({
                frequency: "weekly",
                enabled,
                sendAt: weekly?.send_at ?? "07:00",
                weekday: weekly?.weekday ?? 1,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
