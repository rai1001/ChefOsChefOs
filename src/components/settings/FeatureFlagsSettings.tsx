import { FEATURE_FLAG_KEYS, FeatureFlagKey } from "@/lib/featureFlags";
import { useFeatureFlags, useSetFeatureFlag } from "@/hooks/useFeatureFlags";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const featureFlagLabels: Record<FeatureFlagKey, { title: string; description: string }> = {
  ai_purchase_suggestions: {
    title: "Sugerencias IA de compras",
    description: "Activa recomendaciones por IA en compras (opcional).",
  },
  ai_daily_briefing: {
    title: "Resumen diario IA",
    description: "Activa narrativa IA para el plan diario.",
  },
  ai_menu_recommender: {
    title: "Recomendador IA de menús",
    description: "Permite sugerencias IA en eventos/menús.",
  },
  ai_ops_alert_copy: {
    title: "Redacción IA de alertas",
    description: "IA solo para redactado de mensajes de alerta.",
  },
  clawtbot_integration: {
    title: "Integración Clawtbot",
    description: "Habilita la conexión firmada del agente Clawtbot.",
  },
};

export function FeatureFlagsSettings() {
  const { data: flags, isLoading } = useFeatureFlags();
  const setFeatureFlag = useSetFeatureFlag();

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
          Feature Flags
        </h2>
        <p className="text-sm text-muted-foreground">
          Todas las funciones IA están desactivadas por defecto.
        </p>
      </div>

      <div className="space-y-3">
        {FEATURE_FLAG_KEYS.map((key) => (
          <div
            key={key}
            className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4"
          >
            <div className="space-y-1">
              <Label htmlFor={`feature-${key}`} className="font-medium">
                {featureFlagLabels[key].title}
              </Label>
              <p className="text-xs text-muted-foreground">
                {featureFlagLabels[key].description}
              </p>
            </div>
            <Switch
              id={`feature-${key}`}
              checked={!!flags?.[key]}
              disabled={setFeatureFlag.isPending}
              onCheckedChange={(enabled) =>
                setFeatureFlag.mutate({ key, enabled })
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}
