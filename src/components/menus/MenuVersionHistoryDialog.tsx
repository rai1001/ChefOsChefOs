import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useCreateMenuVersion, useMenuVersions } from "@/hooks/useMenuVersions";
import { diffMenuVersions } from "@/lib/menuVersioning";

interface MenuVersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menuId: string | null;
  menuName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSnapshotItems(snapshot: Record<string, unknown>): Array<Record<string, unknown>> {
  const maybeItems = snapshot.items;
  if (!Array.isArray(maybeItems)) return [];
  return maybeItems.filter((item): item is Record<string, unknown> => isRecord(item));
}

function toSnapshot(version: {
  version_number: number;
  name: string;
  snapshot: Record<string, unknown>;
}) {
  const items = getSnapshotItems(version.snapshot);
  return {
    versionNumber: version.version_number,
    name: version.name,
    items: items.map((item) => ({
      productId: String(item.product_id ?? item.productId ?? ""),
      quantityPerPax: Number(item.quantity_per_pax ?? item.quantityPerPax ?? 0),
      costPrice: Number(item.cost_price ?? item.costPrice ?? 0),
    })),
  };
}

export function MenuVersionHistoryDialog({
  open,
  onOpenChange,
  menuId,
  menuName,
}: MenuVersionHistoryDialogProps) {
  const { data: versions = [], isLoading } = useMenuVersions(menuId);
  const createVersion = useCreateMenuVersion();

  const latest = versions[0];
  const previous = versions[1];
  const diff =
    latest && previous
      ? diffMenuVersions(toSnapshot(previous), toSnapshot(latest))
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Historial de versiones · {menuName ?? "Menú"}</DialogTitle>
          <DialogDescription>
            Crea snapshots y compara cambios de ingredientes, cantidades y coste.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => menuId && createVersion.mutate(menuId)}
            disabled={!menuId || createVersion.isPending}
          >
            {createVersion.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear snapshot
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">No hay versiones para este menú.</p>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
                >
                  <div>
                    <p className="font-medium">Versión {version.version_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(version.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Badge variant="outline">
                    €{(version.cost_per_pax ?? 0).toFixed(2)} / pax
                  </Badge>
                </div>
              ))}
            </div>

            {diff && (
              <div className="rounded-lg border border-border bg-background p-3">
                <h3 className="font-medium mb-2">Diff (últimas 2 versiones)</h3>
                <Separator className="mb-3" />
                <div className="grid gap-2 text-sm">
                  <p>
                    Añadidos: <strong>{diff.added.length}</strong>
                  </p>
                  <p>
                    Eliminados: <strong>{diff.removed.length}</strong>
                  </p>
                  <p>
                    Modificados: <strong>{diff.changed.length}</strong>
                  </p>
                  <p>
                    Delta coste estimado: <strong>{diff.estimatedCostDelta > 0 ? "+" : ""}{diff.estimatedCostDelta.toFixed(2)} €</strong>
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
