import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Camera, Loader2, Upload, FileImage } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

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

interface MenuOCRImportProps {
  onImport: (menuData: ParsedMenu) => void;
}

export function MenuOCRImport({ onImport }: MenuOCRImportProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedMenu | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "Archivo inválido",
        description: "Por favor selecciona una imagen (JPG, PNG)",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
      setParsedData(null);
    };
    reader.readAsDataURL(file);
  };

  const handleProcess = async () => {
    if (!preview) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-menu-image', {
        // Send full Data URL so backend can reliably infer mime type.
        body: { imageBase64: preview },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Error al procesar la imagen');
      }

      setParsedData(data.data);
      toast({
        title: "Menú procesado",
        description: data.message || "Datos extraídos correctamente",
      });
    } catch (error) {
      console.error('Error processing menu:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Error al procesar la imagen",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (parsedData) {
      onImport(parsedData);
      setOpen(false);
      setPreview(null);
      setParsedData(null);
      toast({
        title: "Menú importado",
        description: "Los datos del menú han sido importados correctamente",
      });
    }
  };

  const getMealTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      breakfast: "Desayuno",
      lunch: "Comida",
      dinner: "Cena",
      snack: "Merienda",
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Camera className="h-4 w-4" />
          Importar con OCR
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Importar Menú desde Imagen</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: Image upload */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Seleccionar imagen del menú</Label>
              <div 
                className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {preview ? (
                  <img 
                    src={preview} 
                    alt="Preview" 
                    className="max-h-64 mx-auto rounded object-contain"
                  />
                ) : (
                  <div className="py-8 text-muted-foreground">
                    <FileImage className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Haz clic para seleccionar una imagen</p>
                    <p className="text-xs mt-1">JPG, PNG hasta 10MB</p>
                  </div>
                )}
              </div>
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {preview && !parsedData && (
              <Button 
                onClick={handleProcess} 
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando con IA...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Procesar Imagen
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Right: Parsed results */}
          <div className="space-y-4">
            {parsedData ? (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {getMealTypeLabel(parsedData.mealType)}
                  </Badge>
                  {parsedData.serviceFormat && (
                    <Badge variant="outline">{parsedData.serviceFormat}</Badge>
                  )}
                </div>

                <ScrollArea className="h-64 rounded border border-border p-3">
                  <div className="space-y-4">
                    {parsedData.sections.map((section, idx) => (
                      <div key={idx}>
                        <h4 className="font-semibold text-sm text-primary mb-2">
                          {section.name}
                        </h4>
                        <ul className="space-y-1">
                          {section.items.map((item, itemIdx) => (
                            <li 
                              key={itemIdx}
                              className={`text-sm ${item.highlighted ? 'bg-warning/20 px-2 py-0.5 rounded' : ''}`}
                            >
                              <span className={item.highlighted ? 'font-medium' : ''}>
                                {item.name}
                              </span>
                              {item.description && (
                                <span className="text-muted-foreground text-xs ml-1">
                                  ({item.description})
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {parsedData.observations && (
                  <p className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <strong>Observaciones:</strong> {parsedData.observations}
                  </p>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => { setPreview(null); setParsedData(null); }}
                    className="flex-1"
                  >
                    Nueva imagen
                  </Button>
                  <Button onClick={handleConfirmImport} className="flex-1">
                    Confirmar importación
                  </Button>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-center p-8">
                <div>
                  <Camera className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">
                    Sube una foto del menú para extraer los elementos automáticamente con IA
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
