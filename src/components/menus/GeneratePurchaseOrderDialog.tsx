import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Package, AlertTriangle, Users, Loader2 } from "lucide-react";
import { useProducts, ProductWithRelations } from "@/hooks/useProducts";
import { useCreatePurchase, useAddPurchaseItem, PurchaseItemInsert } from "@/hooks/usePurchases";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MenuSection {
  name: string;
  items: Array<{
    name: string;
    description?: string;
    highlighted?: boolean;
  }>;
}

interface ParsedMenu {
  mealType: string;
  serviceFormat?: string;
  sections: MenuSection[];
  observations?: string;
}

interface ProductNeed {
  product: ProductWithRelations;
  menuItemName: string;
  quantity: number;
  isSelected: boolean;
}

interface SupplierGroup {
  supplierId: string | null;
  supplierName: string;
  products: ProductNeed[];
}

interface GeneratePurchaseOrderDialogProps {
  menu: ParsedMenu;
  menuIndex: number;
}

export function GeneratePurchaseOrderDialog({ menu, menuIndex }: GeneratePurchaseOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [calculationType, setCalculationType] = useState<"pax" | "fixed">("pax");
  const [paxCount, setPaxCount] = useState(10);
  const [productNeeds, setProductNeeds] = useState<ProductNeed[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  const { data: products = [], isLoading: productsLoading } = useProducts();
  const createPurchase = useCreatePurchase();

  // Match menu items to products (fuzzy matching)
  const matchedProducts = useMemo(() => {
    if (!products.length) return [];

    const allMenuItems = menu.sections.flatMap(s => s.items.map(i => i.name));
    const matches: ProductNeed[] = [];

    for (const itemName of allMenuItems) {
      const normalizedItem = itemName.toLowerCase().trim();
      
      // Find matching products
      const matchingProducts = products.filter(p => {
        const normalizedProduct = p.name.toLowerCase().trim();
        return normalizedProduct.includes(normalizedItem) || 
               normalizedItem.includes(normalizedProduct) ||
               normalizedItem.split(" ").some(word => 
                 word.length > 3 && normalizedProduct.includes(word)
               );
      });

      for (const product of matchingProducts) {
        // Avoid duplicates
        if (!matches.some(m => m.product.id === product.id)) {
          matches.push({
            product,
            menuItemName: itemName,
            quantity: calculationType === "pax" ? paxCount : 1,
            isSelected: true,
          });
        }
      }
    }

    return matches;
  }, [products, menu.sections, paxCount, calculationType]);

  // Initialize product needs when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setProductNeeds(matchedProducts);
    }
  };

  // Update quantities when pax changes
  const handlePaxChange = (newPax: number) => {
    setPaxCount(newPax);
    setProductNeeds(prev => 
      prev.map(pn => ({ 
        ...pn, 
        quantity: calculationType === "pax" ? newPax : pn.quantity 
      }))
    );
  };

  // Group products by supplier
  const supplierGroups = useMemo((): SupplierGroup[] => {
    const groups: Map<string | null, SupplierGroup> = new Map();

    for (const need of productNeeds) {
      const supplierId = need.product.supplier_id;
      const supplierName = need.product.supplier?.name || "Sin proveedor";

      if (!groups.has(supplierId)) {
        groups.set(supplierId, {
          supplierId,
          supplierName,
          products: [],
        });
      }

      groups.get(supplierId)!.products.push(need);
    }

    // Sort: "Sin proveedor" at the end
    const sorted = Array.from(groups.values()).sort((a, b) => {
      if (a.supplierId === null) return 1;
      if (b.supplierId === null) return -1;
      return a.supplierName.localeCompare(b.supplierName);
    });

    return sorted;
  }, [productNeeds]);

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    setProductNeeds(prev =>
      prev.map(pn =>
        pn.product.id === productId ? { ...pn, isSelected: !pn.isSelected } : pn
      )
    );
  };

  // Update product quantity
  const updateQuantity = (productId: string, quantity: number) => {
    setProductNeeds(prev =>
      prev.map(pn =>
        pn.product.id === productId ? { ...pn, quantity: Math.max(0, quantity) } : pn
      )
    );
  };

  // Generate purchase orders
  const handleGenerate = async () => {
    if (!hotelId) {
      toast({ variant: "destructive", title: "Error", description: "No hay hotel seleccionado" });
      return;
    }

    const selectedProducts = productNeeds.filter(pn => pn.isSelected && pn.quantity > 0);
    const productsWithSupplier = selectedProducts.filter(pn => pn.product.supplier_id);
    const productsWithoutSupplier = selectedProducts.filter(pn => !pn.product.supplier_id);

    if (productsWithSupplier.length === 0) {
      toast({
        variant: "destructive",
        title: "Sin productos",
        description: "No hay productos con proveedor seleccionados",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Group by supplier
      const bySupplier = new Map<string, ProductNeed[]>();
      for (const pn of productsWithSupplier) {
        const supplierId = pn.product.supplier_id!;
        if (!bySupplier.has(supplierId)) {
          bySupplier.set(supplierId, []);
        }
        bySupplier.get(supplierId)!.push(pn);
      }

      let createdCount = 0;

      // Create a purchase order for each supplier
      for (const [supplierId, items] of bySupplier) {
        const orderDate = new Date().toISOString().split("T")[0];

        // Create the purchase
        const { data: purchase, error: purchaseError } = await supabase
          .from("purchases")
          .insert({
            supplier_id: supplierId,
            hotel_id: hotelId,
            order_date: orderDate,
            status: "draft",
            notes: `Generado desde menú: ${getMealLabel(menu.mealType)}`,
          })
          .select()
          .single();

        if (purchaseError) throw purchaseError;

        // Add items
        const purchaseItems: PurchaseItemInsert[] = items.map(pn => ({
          purchase_id: purchase.id,
          product_id: pn.product.id,
          quantity: pn.quantity,
          unit_price: pn.product.cost_price || 0,
        }));

        const { error: itemsError } = await supabase
          .from("purchase_items")
          .insert(purchaseItems);

        if (itemsError) throw itemsError;

        // Update total
        const total = purchaseItems.reduce(
          (sum, item) => sum + item.quantity * (item.unit_price || 0),
          0
        );

        await supabase
          .from("purchases")
          .update({ total_amount: total })
          .eq("id", purchase.id);

        createdCount++;
      }

      toast({
        title: "Pedidos creados",
        description: `Se han creado ${createdCount} pedido(s) de compra`,
      });

      if (productsWithoutSupplier.length > 0) {
        toast({
          variant: "default",
          title: "Productos sin proveedor",
          description: `${productsWithoutSupplier.length} producto(s) no se incluyeron por no tener proveedor asignado`,
        });
      }

      setOpen(false);
    } catch (error) {
      console.error("Error generating orders:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al generar pedidos",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getMealLabel = (type: string) => {
    const labels: Record<string, string> = {
      breakfast: "Desayuno",
      lunch: "Comida",
      dinner: "Cena",
      snack: "Merienda",
    };
    return labels[type] || type;
  };

  const selectedCount = productNeeds.filter(pn => pn.isSelected).length;
  const noSupplierCount = productNeeds.filter(pn => pn.isSelected && !pn.product.supplier_id).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ShoppingCart className="h-4 w-4" />
          Generar pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Generar Pedidos de Compra
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Calculation type */}
          <Tabs value={calculationType} onValueChange={(v) => setCalculationType(v as "pax" | "fixed")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pax" className="gap-2">
                <Users className="h-4 w-4" />
                Por comensales
              </TabsTrigger>
              <TabsTrigger value="fixed" className="gap-2">
                <Package className="h-4 w-4" />
                Porción fija
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* PAX input */}
          {calculationType === "pax" && (
            <div className="flex items-center gap-4">
              <Label htmlFor="pax" className="whitespace-nowrap">Nº de comensales (PAX):</Label>
              <Input
                id="pax"
                type="number"
                min={1}
                value={paxCount}
                onChange={(e) => handlePaxChange(parseInt(e.target.value) || 1)}
                className="w-24"
              />
            </div>
          )}

          {/* Products by supplier */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Productos encontrados</Label>
              <div className="flex gap-2">
                <Badge variant="secondary">{selectedCount} seleccionados</Badge>
                {noSupplierCount > 0 && (
                  <Badge variant="outline" className="gap-1 text-warning">
                    <AlertTriangle className="h-3 w-3" />
                    {noSupplierCount} sin proveedor
                  </Badge>
                )}
              </div>
            </div>

            {productsLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Cargando productos...
              </div>
            ) : productNeeds.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p>No se encontraron productos que coincidan con el menú</p>
                <p className="text-xs mt-1">Asegúrate de tener productos registrados con nombres similares</p>
              </div>
            ) : (
              <ScrollArea className="h-64 border rounded-lg p-3">
                <div className="space-y-4">
                  {supplierGroups.map((group) => (
                    <div key={group.supplierId || "none"} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm">
                          {group.supplierName}
                        </h4>
                        {group.supplierId === null && (
                          <AlertTriangle className="h-4 w-4 text-warning" />
                        )}
                        <Badge variant="outline" className="text-xs">
                          {group.products.filter(p => p.isSelected).length}/{group.products.length}
                        </Badge>
                      </div>
                      <div className="pl-4 space-y-1.5">
                        {group.products.map((pn) => (
                          <div key={pn.product.id} className="flex items-center gap-3">
                            <Checkbox
                              checked={pn.isSelected}
                              onCheckedChange={() => toggleProduct(pn.product.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{pn.product.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                Desde: {pn.menuItemName}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={0}
                                value={pn.quantity}
                                onChange={(e) => updateQuantity(pn.product.id, parseInt(e.target.value) || 0)}
                                className="w-20 h-8 text-sm"
                                disabled={!pn.isSelected}
                              />
                              <span className="text-xs text-muted-foreground w-8">
                                {pn.product.unit?.abbreviation || "ud"}
                              </span>
                            </div>
                            {pn.product.cost_price && pn.isSelected && (
                              <span className="text-xs text-muted-foreground">
                                {(pn.quantity * pn.product.cost_price).toFixed(2)}€
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || selectedCount === 0 || selectedCount === noSupplierCount}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4" />
                Crear {supplierGroups.filter(g => g.supplierId && g.products.some(p => p.isSelected)).length} pedido(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
