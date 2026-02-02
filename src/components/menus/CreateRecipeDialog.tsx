import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { useProducts } from "@/hooks/useProducts";
import { useCreateMenu } from "@/hooks/useMenus";

interface RecipeItem {
  product_id: string;
  product_name: string;
  quantity_per_pax: number;
}

const menuTypes = [
  { value: "breakfast", label: "Desayuno" },
  { value: "lunch", label: "Comida" },
  { value: "dinner", label: "Cena" },
  { value: "snack", label: "Merienda" },
  { value: "buffet", label: "Buffet" },
  { value: "cocktail", label: "Cóctel" },
];

export function CreateRecipeDialog() {
  const hotelId = useCurrentHotelId();
  const { data: products = [] } = useProducts();
  const createMenu = useCreateMenu();

  const [isOpen, setIsOpen] = useState(false);
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("lunch");
  const [items, setItems] = useState<RecipeItem[]>([]);
  
  // Temp for adding item
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");

  const addItem = () => {
    if (!selectedProduct || !quantity) return;
    
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    setItems(prev => [
      ...prev,
      {
        product_id: selectedProduct,
        product_name: product.name,
        quantity_per_pax: parseFloat(quantity),
      }
    ]);
    setSelectedProduct("");
    setQuantity("");
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!hotelId || !name.trim()) return;

    await createMenu.mutateAsync({
      menu: {
        name: name.trim(),
        description: description || null,
        type,
      },
      items: items.map(item => ({
        product_id: item.product_id,
        quantity_per_pax: item.quantity_per_pax,
      })),
    });

    // Reset form
    setName("");
    setDescription("");
    setType("lunch");
    setItems([]);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Receta
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva Receta / Escandallo</DialogTitle>
          <DialogDescription>
            Define una receta con ingredientes y cantidades por porción
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="recipe-name">Nombre *</Label>
            <Input
              id="recipe-name"
              placeholder="Ej: Paella Valenciana"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recipe-type">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {menuTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipe-description">Descripción</Label>
            <Textarea
              id="recipe-description"
              placeholder="Instrucciones o notas de preparación..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Ingredients */}
          <div className="space-y-3 pt-4 border-t border-border">
            <Label>Ingredientes (por porción)</Label>
            
            {items.length > 0 && (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm">{item.product_name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">{item.quantity_per_pax} uds</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.01"
                placeholder="Cant."
                className="w-20"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={addItem}
                disabled={!selectedProduct || !quantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {products.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No hay productos. Crea productos primero en la sección Productos.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!name.trim() || createMenu.isPending || !hotelId}
          >
            {createMenu.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Receta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
