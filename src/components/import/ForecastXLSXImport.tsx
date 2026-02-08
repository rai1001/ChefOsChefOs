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

  const parseDateValue = (value: unknown): string | null => {
    if (value == null || value === "") return null;

    if (typeof value === "number" && Number.isFinite(value)) {
      const utcDays = Math.floor(value - 25569);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      if (!Number.isNaN(dateInfo.getTime())) return dateInfo.toISOString().slice(0, 10);
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
    }

    if (typeof value === "string") {
      const raw = value.trim();
      if (!raw) return null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

      const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (slash) {
        const left = Number(slash[1]);
        const right = Number(slash[2]);
        let year = Number(slash[3]);
        if (year < 100) year += year < 50 ? 2000 : 1900;

        // Excel exports may come as dd/mm/yyyy or mm/dd/yyyy; choose unambiguous mapping.
        let day = left;
        let month = right;
        if (left <= 12 && right > 12) {
          day = right;
          month = left;
        }

        const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const date = new Date(`${iso}T00:00:00Z`);
        if (!Number.isNaN(date.getTime())) return iso;
      }
    }

    return null;
  };

  const parseNumericValue = (value: unknown): number => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string") {
      const raw = value.trim();
      if (!raw) return 0;

      // Handle european thousands/decimal separators, e.g. 5.572 or 52,94
      const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(",", ".");

      const sanitized = normalized.replace(/[^\d.-]/g, "");
      const parsed = Number(sanitized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  const getFirstAvailable = (row: Record<string, unknown>, keys: string[]): unknown => {
    for (const key of keys) {
      if (row[key] != null && row[key] !== "") return row[key];
    }
    return null;
  };

  const dedupeByDate = (rows: ParsedForecast[]): ParsedForecast[] => {
    const map = new Map<string, ParsedForecast>();
    for (const row of rows) map.set(row.forecast_date, row);
    return [...map.values()].sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));
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
      const forecasts: ParsedForecast[] = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Array<Record<string, unknown>>;

        for (const row of jsonData) {
          const date = parseDateValue(
            getFirstAvailable(row, ["Fecha", "fecha", "Date", "Día", "dia", "DIA"]),
          );
          if (!date) continue;

          // Occupancy should prioritize confirmed rooms, not capacity.
          const occupancy = Math.round(
            parseNumericValue(
              getFirstAvailable(row, ["Confirmada", "confirmada", "Ocupación", "ocupacion", "habs.", "habs"]),
            ),
          );
          const breakfasts = Math.round(
            parseNumericValue(getFirstAvailable(row, ["Desayunos", "desayunos"])),
          );
          const dinners = Math.round(
            parseNumericValue(getFirstAvailable(row, ["Cenas", "cenas", "MP", "mp"])),
          );
          const lunches = Math.round(
            parseNumericValue(getFirstAvailable(row, ["Comidas", "comidas", "Extras", "extras"])),
          );

          forecasts.push({
            forecast_date: date,
            hotel_occupancy: occupancy,
            breakfast_pax: breakfasts,
            half_board_pax: dinners,
            extras_pax: lunches,
          });
        }
      }

      const dedupedForecasts = dedupeByDate(forecasts);

      setParsedForecasts(dedupedForecasts);
      toast({
        title: "Archivo procesado",
        description: `Se encontraron ${dedupedForecasts.length} días de previsión`,
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
