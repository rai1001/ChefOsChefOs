import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApprovals, useResolveApproval } from "@/hooks/useApprovals";
import { Loader2 } from "lucide-react";

interface ApprovalInboxProps {
  entity?: "purchase" | "menu" | "all";
}

export function ApprovalInbox({ entity = "all" }: ApprovalInboxProps) {
  const { data: requests = [], isLoading } = useApprovals("pending");
  const resolveApproval = useResolveApproval();

  const filtered = entity === "all" ? requests : requests.filter((request) => request.entity === entity);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
      <h3 className="font-medium">Bandeja de aprobaciones</h3>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
      ) : (
        filtered.map((request) => (
          <div
            key={request.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{request.entity}</Badge>
                <span className="text-sm font-medium">Req. {request.required_role}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {request.amount != null ? `Importe €${request.amount.toFixed(2)}` : "Sin importe"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveApproval.mutate({ id: request.id, status: "rejected" })}
                disabled={resolveApproval.isPending}
              >
                Rechazar
              </Button>
              <Button
                size="sm"
                onClick={() => resolveApproval.mutate({ id: request.id, status: "approved" })}
                disabled={resolveApproval.isPending}
              >
                Aprobar
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
