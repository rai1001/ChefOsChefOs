import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Copy, Pencil, Euro, FileText } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import {
  MenuWithItems,
  useAddMenuItem,
  useRemoveMenuItem,
  useUpdateMenuItem,
  useDuplicateMenu,
  useDeleteMenu,
} from "@/hooks/useMenus";

interface Props {
  menu: MenuWithItems;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateSheet?: (menu: MenuWithItems) => void;
}

export function RecipeDetailDialog({ menu, open, onOpenChange, onGenerateSheet }: Props) {
  const { data: products = [] } = useProducts();
  const addItem = useAddMenuItem();
  const removeItem = useRemoveMenuItem();
  const updateItem = useUpdateMenuItem();
  const duplicateMenu = useDuplicateMenu();
  const deleteMenu = useDeleteMenu();

  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");

  const handleAddItem = async () => {
    if (!selectedProduct || !quantity) return;

    await addItem.mutateAsync({
      menu_id: menu.id,
      product_id: selectedProduct,
      quantity_per_pax: parseFloat(quantity),
    });

    setSelectedProduct("");
    setQuantity("");
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem.mutateAsync({ id: itemId, menu_id: menu.id });
  };

  const handleUpdateItem = async (itemId: string) => {
    if (!editQuantity) return;

    await updateItem.mutateAsync({
      id: itemId,
      menu_id: menu.id,
      quantity_per_pax: parseFloat(editQuantity),
    });

    setEditingItem(null);
    setEditQuantity("");
  };

  const handleDuplicate = async () => {
    await duplicateMenu.mutateAsync(menu.id);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await deleteMenu.mutateAsync(menu.id);
    onOpenChange(false);
  };

  const getTypeLabel = (type: string | null) => {
    const types: Record<string, string> = {
      breakfast: "Desayuno",
      lunch: "Comida",
      dinner: "Cena",
      snack: "Merienda",
      buffet: "Buffet",
      cocktail: "Cóctel",
    };
    return types[type || ""] || type || "Sin tipo";
  };

  // Products not yet in this menu
  const availableProducts = products.filter(
    (p) => !menu.menu_items.some((item) => item.product_id === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-xl">{menu.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {menu.description || "Sin descripción"}
              </DialogDescription>
            </div>
            <Badge variant="outline">{getTypeLabel(menu.type)}</Badge>
          </div>
        </DialogHeader>

        {/* Cost summary */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary">
          <Euro className="h-5 w-5" />
          <span className="font-medium">
            Coste por porción: {(menu.cost_per_pax || 0).toFixed(2)} €
          </span>
        </div>

        {/* Ingredients list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-semibold">
              Ingredientes ({menu.menu_items.length})
            </Label>
          </div>

          {menu.menu_items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
              No hay ingredientes. Añade productos a esta receta.
            </p>
          ) : (
            <div className="space-y-2">
              {menu.menu_items.map((item) => {
                const product = item.product;
                const unitAbbr = product?.unit?.abbreviation || "uds";
                const itemCost = (product?.cost_price || 0) * item.quantity_per_pax;
                const isEditing = editingItem === item.id;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{product?.name || "Producto desconocido"}</span>
                      <div className="text-sm text-muted-foreground">
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <Input
                              type="number"
                              step="0.01"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-24 h-8"
                              autoFocus
                            />
                            <span>{unitAbbr}/pax</span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleUpdateItem(item.id)}
                              disabled={updateItem.isPending}
                            >
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingItem(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <>
                            {item.quantity_per_pax} {unitAbbr}/pax → {itemCost.toFixed(2)} €
                          </>
                        )}
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingItem(item.id);
                            setEditQuantity(item.quantity_per_pax.toString());
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={removeItem.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add ingredient */}
          <div className="pt-3 border-t">
            <Label className="text-sm font-medium mb-2 block">Añadir ingrediente</Label>
            <div className="flex gap-2">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {availableProducts.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      No hay más productos disponibles
                    </SelectItem>
                  ) : (
                    availableProducts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({(p.cost_price || 0).toFixed(2)} €/{p.unit?.abbreviation || "ud"})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                placeholder="Cant."
                className="w-24"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Button
                size="icon"
                onClick={handleAddItem}
                disabled={!selectedProduct || !quantity || addItem.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDuplicate}
              disabled={duplicateMenu.isPending}
            >
              <Copy className="h-4 w-4 mr-2" />
              Duplicar
            </Button>
            {onGenerateSheet && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onGenerateSheet(menu)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Hoja de Producción
              </Button>
            )}
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar receta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará "{menu.name}" permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
