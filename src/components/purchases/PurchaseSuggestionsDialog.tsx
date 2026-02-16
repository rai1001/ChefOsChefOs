import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart, Sparkles } from "lucide-react";
import { usePurchaseSuggestions } from "@/hooks/usePurchaseSuggestions";
import { useProducts } from "@/hooks/useProducts";
import {
  useAddPurchaseItem,
  useCreatePurchase,
  useUpdatePurchaseTotal,
} from "@/hooks/usePurchases";

interface PurchaseSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function severityTone(severity: "critical" | "medium" | "low"): string {
  if (severity === "critical") return "bg-destructive/10 text-destructive border-destructive/30";
  if (severity === "medium") return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
}

function severityLabel(severity: "critical" | "medium" | "low"): string {
  if (severity === "critical") return "Critico";
  if (severity === "medium") return "Medio";
  return "Bajo";
}

export function PurchaseSuggestionsDialog({
  open,
  onOpenChange,
}: PurchaseSuggestionsDialogProps) {
  const { data: groups = [], isLoading } = usePurchaseSuggestions();
  const { data: products = [] } = useProducts();
  const createPurchase = useCreatePurchase();
  const addPurchaseItem = useAddPurchaseItem();
  const updatePurchaseTotal = useUpdatePurchaseTotal();
  const [creatingSupplierId, setCreatingSupplierId] = useState<string | null>(null);

  const unitPriceByProduct = useMemo(
    () =>
      new Map(products.map((product) => [product.id, product.cost_price] as const)),
    [products],
  );

  const handleQuickCreate = async (supplierId: string) => {
    const group = groups.find((item) => item.supplierId === supplierId);
    if (!group || group.suggestions.length === 0) return;

    setCreatingSupplierId(supplierId);
    try {
      const purchase = await createPurchase.mutateAsync({
        supplier_id: supplierId,
        status: "draft",
        notes: "Generado automaticamente desde sugerencias de compra",
      });

      for (const suggestion of group.suggestions) {
        const unitPrice = unitPriceByProduct.get(suggestion.productId) ?? null;
        await addPurchaseItem.mutateAsync({
          purchase_id: purchase.id,
          product_id: suggestion.productId,
          quantity: suggestion.recommended_qty,
          unit_price: unitPrice,
        });
      }

      await updatePurchaseTotal.mutateAsync(purchase.id);
    } finally {
      setCreatingSupplierId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Sugerencias automaticas de compra
          </DialogTitle>
          <DialogDescription>
            Basado en prevision, eventos, menus, stock actual y umbrales min/optimo/critico.
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
          <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1">
            {groups.map((group) => (
              <div key={group.supplierId} className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{group.supplierName}</h3>
                    <Badge variant="outline">{group.suggestions.length} sugerencias</Badge>
                    {group.criticalCount > 0 && (
                      <Badge variant="destructive">{group.criticalCount} criticas</Badge>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleQuickCreate(group.supplierId)}
                    disabled={creatingSupplierId === group.supplierId}
                  >
                    {creatingSupplierId === group.supplierId ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-4 w-4 mr-2" />
                    )}
                    Compra rapida
                  </Button>
                </div>

                <div className="space-y-2">
                  {group.suggestions.map((suggestion) => (
                    <div
                      key={suggestion.productId}
                      className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{suggestion.productName}</p>
                        <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                      </div>
                      <Badge variant="outline" className={severityTone(suggestion.severity)}>
                        {severityLabel(suggestion.severity)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Stock {suggestion.current_qty.toFixed(2)} / Min {suggestion.minStock.toFixed(2)}
                      </div>
                      <div className="text-right">
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          +{suggestion.recommended_qty.toFixed(2)}
                        </Badge>
                        {suggestion.estimatedCost != null && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            EUR {suggestion.estimatedCost.toFixed(2)}
                          </p>
                        )}
                      </div>
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
