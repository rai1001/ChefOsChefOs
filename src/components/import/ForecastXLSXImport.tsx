import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Upload, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as XLSX from "xlsx";
import { useBulkUpsertForecasts } from "@/hooks/useForecasts";

interface ParsedForecast {
  forecast_date: string;
  hotel_occupancy: number;
  breakfast_pax: number;
  half_board_pax: number;
  extras_pax: number;
}

export function ForecastXLSXImport() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedForecasts, setParsedForecasts] = useState<ParsedForecast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const bulkUpsert = useBulkUpsertForecasts();

  const parseExcelDate = (excelDate: number | string): string | null => {
    if (typeof excelDate === 'number') {
      // Excel date serial number
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    if (typeof excelDate === 'string' && excelDate.includes('/')) {
      // Format: M/D/YY
      const parts = excelDate.split('/');
      if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        const year = parseInt(parts[2]) < 50 ? `20${parts[2]}` : `19${parts[2]}`;
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        variant: "destructive",
        title: "Archivo inválido",
        description: "Por favor selecciona un archivo Excel (.xlsx o .xls)",
      });
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

      const forecasts: ParsedForecast[] = [];

      for (const row of jsonData) {
        // Look for date column
        const dateValue = row['Fecha'] ?? row['fecha'] ?? row['Date'];
        const date = parseExcelDate(dateValue as number | string);
        
        if (!date) continue;

        // Extract occupancy data
        const occupancy = parseInt(String(row['habs.'] ?? row['Confirmada'] ?? row['Ocupación'] ?? 0));
        const breakfast = parseInt(String(row['Desayunos'] ?? row['desayunos'] ?? 0));
        const dinners = parseInt(String(row['Cenas'] ?? row['cenas'] ?? 0));
        const lunches = parseInt(String(row['Comidas'] ?? row['comidas'] ?? 0));

        forecasts.push({
          forecast_date: date,
          hotel_occupancy: occupancy,
          breakfast_pax: breakfast,
          half_board_pax: dinners,
          extras_pax: lunches,
        });
      }

      // Sort by date
      forecasts.sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));

      setParsedForecasts(forecasts);
      toast({
        title: "Archivo procesado",
        description: `Se encontraron ${forecasts.length} días de previsión`,
      });
    } catch (error) {
      console.error('Error parsing XLSX:', error);
      toast({
        variant: "destructive",
        title: "Error al procesar",
        description: error instanceof Error ? error.message : "Error al leer el archivo",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    await bulkUpsert.mutateAsync(parsedForecasts);
    setOpen(false);
    setParsedForecasts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar Ocupación
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Importar Previsión de Ocupación</DialogTitle>
          <DialogDescription>
            Carga un archivo Excel con columnas de fecha, ocupación y servicios para reemplazar la previsión actual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Seleccionar archivo Excel</Label>
            <div className="flex gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={loading || bulkUpsert.isPending}
              />
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground">
              El archivo debe contener: Fecha, Habitaciones, Desayunos, Cenas, Comidas
            </p>
          </div>

          {parsedForecasts.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                Vista previa: {parsedForecasts.length} días de previsión
              </div>
              <ScrollArea className="h-64 rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Ocupación</TableHead>
                      <TableHead className="text-right">Desayunos</TableHead>
                      <TableHead className="text-right">MP</TableHead>
                      <TableHead className="text-right">Extras</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedForecasts.slice(0, 30).map((forecast, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {new Date(forecast.forecast_date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </TableCell>
                        <TableCell className="text-right">{forecast.hotel_occupancy}</TableCell>
                        <TableCell className="text-right">{forecast.breakfast_pax}</TableCell>
                        <TableCell className="text-right">{forecast.half_board_pax}</TableCell>
                        <TableCell className="text-right">{forecast.extras_pax}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedForecasts.length > 30 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    ... y {parsedForecasts.length - 30} días más
                  </p>
                )}
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setParsedForecasts([])}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmImport} 
                  className="gap-2"
                  disabled={bulkUpsert.isPending}
                >
                  {bulkUpsert.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Importar {parsedForecasts.length} días
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
