import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { usePurchaseSuggestions } from "@/hooks/usePurchaseSuggestions";

interface PurchaseSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseSuggestionsDialog({
  open,
  onOpenChange,
}: PurchaseSuggestionsDialogProps) {
  const { data: groups = [], isLoading } = usePurchaseSuggestions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Sugerencias automáticas de compra</DialogTitle>
          <DialogDescription>
            Motor determinista basado en demanda, stock disponible y lead-time del proveedor.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8">
            No hay sugerencias pendientes para el periodo actual.
          </p>
        ) : (
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.supplierId} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-medium">{group.supplierName}</h3>
                  <Badge variant="outline">{group.suggestions.length} sugerencias</Badge>
                </div>
                <div className="space-y-2">
                  {group.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.productId}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{suggestion.productName}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Stock: {suggestion.current_qty.toFixed(2)}
                      </div>
                      <Badge className="bg-primary/10 text-primary border-primary/20">
                        +{suggestion.recommended_qty.toFixed(2)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
