import { useState, useRef } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, FileText, Loader2, Check, X, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProducts, useSuppliers } from "@/hooks/useProducts";
import { useCreateInventoryLot } from "@/hooks/useInventory";
import { useToast } from "@/hooks/use-toast";

interface ParsedItem {
  name: string;
  quantity: number;
  unit?: string;
  matched_product_id?: string;
}

interface ParsedDeliveryNote {
  supplier_name: string | null;
  document_number: string | null;
  date: string | null;
  items: ParsedItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeliveryNoteImport({ open, onOpenChange }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedDeliveryNote | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [importLocation, setImportLocation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();
  const createLot = useCreateInventoryLot();
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await processImage(file);
  };

  const processImage = async (file: File) => {
    setIsProcessing(true);
    setParsedData(null);

    try {
      // Convert to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call edge function
      const { data, error } = await supabase.functions.invoke("parse-delivery-note", {
        body: { imageBase64: base64 },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to parse delivery note");
      }

      const parsed = data.data as ParsedDeliveryNote;

      // Try to match items with products
      const matchedItems = parsed.items.map((item) => {
        const matchedProduct = products.find(
          (p) => p.name.toLowerCase().includes(item.name.toLowerCase()) ||
                 item.name.toLowerCase().includes(p.name.toLowerCase())
        );
        return {
          ...item,
          matched_product_id: matchedProduct?.id,
        };
      });

      parsed.items = matchedItems;
      setParsedData(parsed);
      setItems(matchedItems);

      // Try to match supplier
      if (parsed.supplier_name) {
        const matchedSupplier = suppliers.find(
          (s) => s.name.toLowerCase().includes(parsed.supplier_name!.toLowerCase()) ||
                 parsed.supplier_name!.toLowerCase().includes(s.name.toLowerCase())
        );
        if (matchedSupplier) {
          setSelectedSupplier(matchedSupplier.id);
        }
      }

      toast({
        title: "Albarán procesado",
        description: `Se han detectado ${matchedItems.length} productos`,
      });
    } catch (error) {
      console.error("Error processing delivery note:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar el albarán",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItemProduct = (index: number, productId: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, matched_product_id: productId } : item
      )
    );
  };

  const updateItemQuantity = (index: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity } : item
      )
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const validItems = items.filter((item) => item.matched_product_id && item.quantity > 0);

    if (validItems.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No hay productos válidos para importar",
      });
      return;
    }

    setIsProcessing(true);

    try {
      for (const item of validItems) {
        await createLot.mutateAsync({
          product_id: item.matched_product_id!,
          quantity: item.quantity,
          location: importLocation || null,
          supplier_id: selectedSupplier || null,
          reference_document: parsedData?.document_number || null,
        });
      }

      toast({
        title: "Importación completada",
        description: `Se han importado ${validItems.length} lotes al inventario`,
      });

      // Reset state
      setParsedData(null);
      setItems([]);
      setSelectedSupplier("");
      setImportLocation("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error importing lots:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al importar los lotes",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setParsedData(null);
    setItems([]);
    setSelectedSupplier("");
    setImportLocation("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Albarán con OCR</DialogTitle>
          <DialogDescription>
            Saca una foto del albarán o sube una imagen para extraer automáticamente los productos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Image capture/upload */}
          {!parsedData && (
            <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-border rounded-xl">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Procesando imagen con OCR...</p>
                </div>
              ) : (
                <>
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground text-center">
                    Sube una imagen del albarán para extraer los productos automáticamente
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Cámara
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Subir imagen
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </>
              )}
            </div>
          )}

          {/* Parsed results */}
          {parsedData && items.length > 0 && (
            <>
              {/* Header info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar proveedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {parsedData.supplier_name && (
                    <p className="text-xs text-muted-foreground">
                      Detectado: {parsedData.supplier_name}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Ubicación destino</Label>
                  <Input
                    value={importLocation}
                    onChange={(e) => setImportLocation(e.target.value)}
                    placeholder="Ej: Cámara 1, Estante A"
                  />
                </div>
              </div>

              {parsedData.document_number && (
                <p className="text-sm text-muted-foreground">
                  Nº Albarán: <span className="font-mono">{parsedData.document_number}</span>
                </p>
              )}

              {/* Items table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto detectado</TableHead>
                      <TableHead>Producto asignado</TableHead>
                      <TableHead className="w-24">Cantidad</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {item.name}
                          {item.unit && (
                            <span className="text-muted-foreground ml-1">({item.unit})</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={item.matched_product_id || ""}
                            onValueChange={(v) => updateItemProduct(index, v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Asignar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value) || 0)}
                            className="h-8 w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-sm text-muted-foreground">
                {items.filter((i) => i.matched_product_id).length} de {items.length} productos asignados
              </p>
            </>
          )}

          {parsedData && items.length === 0 && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No se detectaron productos en la imagen. Intenta con otra foto más clara.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setParsedData(null)}
              >
                Intentar de nuevo
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          {parsedData && items.length > 0 && (
            <Button
              onClick={handleImport}
              disabled={isProcessing || items.filter((i) => i.matched_product_id).length === 0}
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Importar {items.filter((i) => i.matched_product_id).length} productos
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
