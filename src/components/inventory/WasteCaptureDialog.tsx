import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { useInventoryLots } from "@/hooks/useInventory";
import { useCreateInventoryWaste, WASTE_CAUSES } from "@/hooks/useInventoryWaste";

interface WasteCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WasteCaptureDialog({ open, onOpenChange }: WasteCaptureDialogProps) {
  const { data: products = [] } = useProducts();
  const { data: lots = [] } = useInventoryLots();
  const createWaste = useCreateInventoryWaste();

  const [productId, setProductId] = useState("");
  const [lotId, setLotId] = useState("");
  const [qty, setQty] = useState("");
  const [cause, setCause] = useState("expired");
  const [note, setNote] = useState("");

  const reset = () => {
    setProductId("");
    setLotId("");
    setQty("");
    setCause("expired");
    setNote("");
  };

  const handleSave = async () => {
    if (!productId || !qty) return;
    await createWaste.mutateAsync({
      product_id: productId,
      lot_id: lotId || null,
      qty: Number(qty),
      cause,
      note: note || null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar merma</DialogTitle>
          <DialogDescription>
            Registra mermas reales y su causa. Se actualizará inventario automáticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="waste-product">Producto</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger id="waste-product">
                <SelectValue placeholder="Selecciona producto..." />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="waste-lot">Lote (opcional)</Label>
            <Select value={lotId || "none"} onValueChange={(value) => setLotId(value === "none" ? "" : value)}>
              <SelectTrigger id="waste-lot">
                <SelectValue placeholder="Sin lote específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin lote específico</SelectItem>
                {lots
                  .filter((lot) => !productId || lot.product_id === productId)
                  .map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {(lot.product?.name ?? "Producto")} · {lot.quantity}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="waste-qty">Cantidad</Label>
              <Input
                id="waste-qty"
                type="number"
                min="0"
                step="0.01"
                value={qty}
                onChange={(event) => setQty(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="waste-cause">Causa</Label>
              <Select value={cause} onValueChange={setCause}>
                <SelectTrigger id="waste-cause">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WASTE_CAUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="waste-note">Nota</Label>
            <Textarea
              id="waste-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Detalles opcionales..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={createWaste.isPending || !productId || !qty}>
            {createWaste.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar merma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
