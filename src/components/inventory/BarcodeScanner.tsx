import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Camera, Barcode, Loader2, Check, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInventoryLots, InventoryLotWithRelations } from "@/hooks/useInventory";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "entry" | "exit";
}

export function BarcodeScanner({ open, onOpenChange, mode }: Props) {
  const [barcode, setBarcode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [matchedLot, setMatchedLot] = useState<InventoryLotWithRelations | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: lots = [] } = useInventoryLots();
  const { toast } = useToast();

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const searchByBarcode = useCallback(async (code: string) => {
    if (!code.trim()) return;

    setIsSearching(true);
    setMatchedLot(null);

    try {
      // Search in inventory_lots by barcode
      const { data, error } = await supabase
        .from("inventory_lots")
        .select(`
          *,
          product:products(id, name),
          supplier:suppliers(id, name)
        `)
        .eq("barcode", code.trim())
        .gt("quantity", 0)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (data) {
        setMatchedLot(data as InventoryLotWithRelations);
        toast({
          title: "Producto encontrado",
          description: data.product?.name || "Lote encontrado",
        });
      } else {
        toast({
          variant: "destructive",
          title: "No encontrado",
          description: "No se encontró ningún lote con este código de barras",
        });
      }
    } catch (error) {
      console.error("Error searching barcode:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al buscar el código de barras",
      });
    } finally {
      setIsSearching(false);
    }
  }, [toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      searchByBarcode(barcode);
    }
  };

  const handleMovement = async () => {
    if (!matchedLot) return;

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Cantidad inválida",
      });
      return;
    }

    if (mode === "exit" && qty > matchedLot.quantity) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Solo hay ${matchedLot.quantity} unidades disponibles`,
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Record the movement
      const { error: movementError } = await supabase
        .from("inventory_movements")
        .insert({
          lot_id: matchedLot.id,
          product_id: matchedLot.product_id,
          movement_type: mode,
          quantity: qty,
          barcode: barcode.trim(),
        });

      if (movementError) throw movementError;

      // Update lot quantity
      const newQuantity = mode === "entry" 
        ? matchedLot.quantity + qty 
        : matchedLot.quantity - qty;

      const { error: updateError } = await supabase
        .from("inventory_lots")
        .update({ quantity: newQuantity })
        .eq("id", matchedLot.id);

      if (updateError) throw updateError;

      toast({
        title: mode === "entry" ? "Entrada registrada" : "Salida registrada",
        description: `${qty} unidades de ${matchedLot.product?.name}`,
      });

      // Reset for next scan
      setBarcode("");
      setMatchedLot(null);
      setQuantity("1");
      inputRef.current?.focus();
    } catch (error) {
      console.error("Error processing movement:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al procesar el movimiento",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setBarcode("");
    setMatchedLot(null);
    setQuantity("1");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            {mode === "entry" ? "Entrada por código" : "Salida por código"}
          </DialogTitle>
          <DialogDescription>
            Escanea o introduce el código de barras del producto
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Barcode input */}
          <div className="space-y-2">
            <Label htmlFor="barcode">Código de barras</Label>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                id="barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escanear o escribir código..."
                className="font-mono"
                autoComplete="off"
              />
              <Button
                variant="outline"
                onClick={() => searchByBarcode(barcode)}
                disabled={isSearching || !barcode.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Buscar"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Pulsa Enter para buscar automáticamente
            </p>
          </div>

          {/* Matched lot */}
          {matchedLot && (
            <div className={cn(
              "rounded-lg border p-4",
              mode === "entry" ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
            )}>
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  mode === "entry" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                )}>
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium">{matchedLot.product?.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Stock actual: {matchedLot.quantity} • Ubicación: {matchedLot.location || "—"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qty">
                  {mode === "entry" ? "Cantidad a añadir" : "Cantidad a retirar"}
                </Label>
                <Input
                  id="qty"
                  type="number"
                  min="1"
                  max={mode === "exit" ? matchedLot.quantity : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          )}

          {/* Quick select from existing lots */}
          {!matchedLot && lots.length > 0 && (
            <div className="space-y-2">
              <Label>O selecciona un lote existente</Label>
              <Select onValueChange={(lotId) => {
                const lot = lots.find(l => l.id === lotId);
                if (lot) {
                  setMatchedLot(lot);
                  setBarcode(lot.barcode || lot.lot_number || "");
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar lote..." />
                </SelectTrigger>
                <SelectContent>
                  {lots.slice(0, 20).map((lot) => (
                    <SelectItem key={lot.id} value={lot.id}>
                      {lot.product?.name} ({lot.quantity}) - {lot.location || "Sin ubicación"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cerrar
          </Button>
          {matchedLot && (
            <Button
              onClick={handleMovement}
              disabled={isProcessing}
              className={mode === "exit" ? "bg-warning hover:bg-warning/90" : ""}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              {mode === "entry" ? "Registrar entrada" : "Registrar salida"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
