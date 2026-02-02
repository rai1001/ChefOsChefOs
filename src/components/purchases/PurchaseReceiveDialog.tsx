import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Camera,
  Upload,
  Package,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PurchaseReceiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId: string;
  supplierName: string;
  expectedItems?: { id: string; name: string; quantity: number }[];
  onReceive: (data: {
    is_complete: boolean;
    delivery_issues?: string;
    delivery_note_url?: string;
  }) => Promise<void>;
}

export function PurchaseReceiveDialog({
  open,
  onOpenChange,
  purchaseId,
  supplierName,
  expectedItems = [],
  onReceive,
}: PurchaseReceiveDialogProps) {
  const { toast } = useToast();
  const [isComplete, setIsComplete] = useState(true);
  const [issues, setIssues] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // OCR processing
    setIsProcessingOCR(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result as string;
          resolve(result.split(",")[1]);
        };
        r.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("parse-delivery-note", {
        body: { image: base64 },
      });

      if (error) throw error;

      if (data?.items && expectedItems.length > 0) {
        // Check if received quantities match expected
        const mismatches: string[] = [];
        
        for (const expected of expectedItems) {
          const received = data.items.find(
            (item: { name: string; quantity: number }) =>
              item.name.toLowerCase().includes(expected.name.toLowerCase()) ||
              expected.name.toLowerCase().includes(item.name.toLowerCase())
          );

          if (!received) {
            mismatches.push(`${expected.name}: esperado ${expected.quantity}, no encontrado`);
          } else if (received.quantity < expected.quantity) {
            mismatches.push(
              `${expected.name}: esperado ${expected.quantity}, recibido ${received.quantity}`
            );
          }
        }

        if (mismatches.length > 0) {
          setIsComplete(false);
          setIssues(mismatches.join("\n"));
        }
      }

      toast({
        title: "Albarán procesado",
        description: data?.items?.length
          ? `Se detectaron ${data.items.length} productos`
          : "No se pudieron detectar productos",
      });
    } catch (error) {
      console.error("OCR error:", error);
      toast({
        variant: "destructive",
        title: "Error al procesar",
        description: "No se pudo analizar el albarán",
      });
    } finally {
      setIsProcessingOCR(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onReceive({
        is_complete: isComplete,
        delivery_issues: issues || undefined,
        delivery_note_url: imagePreview || undefined,
      });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setIsComplete(true);
    setIssues("");
    setImagePreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) resetForm();
      onOpenChange(o);
    }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Recibir Pedido
          </DialogTitle>
          <DialogDescription>
            Confirma la recepción del pedido de {supplierName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Delivery Note Upload */}
          <div className="grid gap-2">
            <Label>Foto del albarán (opcional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Albarán"
                  className="w-full h-40 object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => setImagePreview(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
                {isProcessingOCR && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-lg">
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      <p className="text-sm mt-2">Analizando albarán...</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capturar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Subir
                </Button>
              </div>
            )}
          </div>

          {/* Complete Status */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
            <Checkbox
              id="is_complete"
              checked={isComplete}
              onCheckedChange={(v) => setIsComplete(v === true)}
            />
            <div className="flex-1">
              <Label htmlFor="is_complete" className="cursor-pointer flex items-center gap-2">
                {isComplete ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    Pedido completo
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Pedido incompleto
                  </>
                )}
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isComplete
                  ? "Todos los productos llegaron correctamente"
                  : "Faltan productos o cantidades incorrectas"}
              </p>
            </div>
          </div>

          {/* Issues */}
          {!isComplete && (
            <div className="grid gap-2 animate-fade-in">
              <Label htmlFor="issues">Detalle de incidencias</Label>
              <Textarea
                id="issues"
                value={issues}
                onChange={(e) => setIssues(e.target.value)}
                placeholder="Describe qué productos faltan o qué problemas hubo..."
                rows={4}
              />
            </div>
          )}

          {/* Expected Items Preview */}
          {expectedItems.length > 0 && (
            <div className="grid gap-2">
              <Label>Productos esperados</Label>
              <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-muted/30 rounded-lg">
                {expectedItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.quantity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || isProcessingOCR}
            className={cn(!isComplete && "bg-warning text-warning-foreground hover:bg-warning/90")}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isComplete ? "Confirmar recepción" : "Registrar incidencia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
