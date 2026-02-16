import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { getHealthLabel, getHealthTone } from "@/lib/healthStatus";

function OverallIcon({ status }: { status: "healthy" | "warning" | "critical" | "unknown" }) {
  if (status === "healthy") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-warning" />;
  if (status === "critical") return <ShieldAlert className="h-4 w-4 text-destructive" />;
  return <Activity className="h-4 w-4 text-muted-foreground" />;
}

export function HealthBar() {
  const { data, isLoading } = useSystemHealth();
  const { roles } = useAuth();
  const isSuperAdmin = roles.includes("super_admin");

  return (
    <div className="border-b border-border bg-muted/20">
      <div className="px-4 lg:px-6 py-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 pr-2 border-r border-border">
          <OverallIcon status={data?.overallStatus ?? "unknown"} />
          <span className="text-xs font-medium">
            Estado 24/7 {isLoading ? "actualizando..." : getHealthLabel(data?.overallStatus ?? "unknown")}
          </span>
        </div>

        {(data?.signals ?? []).map((signal) => (
          <Badge
            key={signal.key}
            variant="outline"
            className={`text-[11px] ${getHealthTone(signal.status)}`}
            title={signal.detail}
          >
            {signal.label}: {signal.metric ?? getHealthLabel(signal.status)}
          </Badge>
        ))}

        {isSuperAdmin && (
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs ml-auto">
            <Link to="/status">Ver estado técnico</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
