import { useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSystemHealth } from "@/hooks/useSystemHealth";
import { useOpsTelemetry } from "@/hooks/useOpsTelemetry";
import { useToast } from "@/hooks/use-toast";
import { getHealthLabel, getHealthTone } from "@/lib/healthStatus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Sin registro";
  return format(new Date(value), "d MMM yyyy, HH:mm", { locale: es });
}

const Status = () => {
  const { roles, loading: authLoading } = useAuth();
  const { data, isLoading, isFetching, refetch } = useSystemHealth();
  const { logEvent } = useOpsTelemetry();
  const { toast } = useToast();
  const [isSavingBackupCheck, setIsSavingBackupCheck] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!roles.includes("super_admin")) {
    return <Navigate to="/" replace />;
  }

  const handleRegisterBackupCheck = async () => {
    try {
      setIsSavingBackupCheck(true);
      await logEvent({
        entity: "backup",
        action: "restore_test_ok",
        payload: {
          source: "status_page",
          verified_at: new Date().toISOString(),
        },
      });
      toast({
        title: "Backup verificado",
        description: "Se registró la verificación de restauración.",
      });
      await refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo registrar la verificación.",
      });
    } finally {
      setIsSavingBackupCheck(false);
    }
  };

  return (
    <MainLayout
      title="Estado Técnico 24/7"
      subtitle="Observabilidad operativa para soporte y super administración"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={getHealthTone(data?.overallStatus ?? "unknown")}>
              Estado general: {getHealthLabel(data?.overallStatus ?? "unknown")}
            </Badge>
            <Badge variant="outline">
              Última actualización: {formatDateTime(data?.generatedAt)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
              Refrescar
            </Button>
            <Button
              size="sm"
              onClick={handleRegisterBackupCheck}
              disabled={isSavingBackupCheck}
            >
              {isSavingBackupCheck ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4 mr-2" />
              )}
              Registrar verificación backup
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {(data?.signals ?? []).map((signal) => (
                <Card key={signal.key} className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                      <span>{signal.label}</span>
                      <Badge variant="outline" className={getHealthTone(signal.status)}>
                        {getHealthLabel(signal.status)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-foreground">{signal.detail}</p>
                    <p className="text-xs text-muted-foreground">
                      Métrica: {signal.metric ?? "n/a"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Actualizado: {formatDateTime(signal.updatedAt)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Latencia DB</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold">
                    {data?.summary.dbLatencyMs ?? "—"} {data?.summary.dbLatencyMs ? "ms" : ""}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Errores (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold">
                    {data?.summary.recentErrorCount ?? 0}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Automatizaciones activas</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-semibold">
                    {data?.summary.activeAutomations ?? 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Errores recientes</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.recentErrors?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Entidad</TableHead>
                          <TableHead>Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentErrors.slice(0, 12).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell>{row.entity}</TableCell>
                            <TableCell>{row.action}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin errores en las últimas 24h.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Actividad técnica reciente</CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.recentTechnicalEvents?.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Entidad</TableHead>
                          <TableHead>Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.recentTechnicalEvents.slice(0, 12).map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="text-xs text-muted-foreground">
                              {formatDateTime(row.created_at)}
                            </TableCell>
                            <TableCell>{row.entity}</TableCell>
                            <TableCell>{row.action}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default Status;
