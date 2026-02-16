import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useBulkUpsertForecasts } from "@/hooks/useForecasts";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedForecast {
  forecast_date: string;
  hotel_occupancy: number;
  breakfast_pax: number;
  half_board_pax: number;
  extras_pax: number;
}

interface ImportStats {
  scannedRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesMerged: number;
}

const EMPTY_STATS: ImportStats = {
  scannedRows: 0,
  validRows: 0,
  invalidRows: 0,
  duplicatesMerged: 0,
};

function normalizeHeaderToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function parseDateValue(value: unknown): string | null {
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

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash) {
    const left = Number(slash[1]);
    const right = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;

    let day = left;
    let month = right;
    if (left <= 12 && right > 12) {
      day = right;
      month = left;
    }

    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso) return iso;
  }

  return null;
}

function parseNumericValue(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.replace(",", ".");
  const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampPax(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 10000) return null;
  return rounded;
}

function isReasonableForecastDate(dateIso: string): boolean {
  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  return year >= currentYear - 2 && year <= currentYear + 3;
}

function pickValue(row: Record<string, unknown>, keys: string[]): unknown {
  const normalizedEntries = Object.entries(row).map(([key, value]) => ({
    key: normalizeHeaderToken(key),
    value,
  }));

  for (const alias of keys.map(normalizeHeaderToken)) {
    const found = normalizedEntries.find((entry) => entry.key === alias);
    if (found && found.value != null && found.value !== "") return found.value;
  }
  return null;
}

function dedupeForecastsByDate(rows: ParsedForecast[]): { rows: ParsedForecast[]; duplicates: number } {
  const byDate = new Map<string, ParsedForecast>();
  for (const row of rows) {
    byDate.set(row.forecast_date, row);
  }
  const deduped = [...byDate.values()].sort((a, b) => a.forecast_date.localeCompare(b.forecast_date));
  return {
    rows: deduped,
    duplicates: Math.max(rows.length - deduped.length, 0),
  };
}

export function ForecastXLSXImport() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedForecasts, setParsedForecasts] = useState<ParsedForecast[]>([]);
  const [stats, setStats] = useState<ImportStats>(EMPTY_STATS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const bulkUpsert = useBulkUpsertForecasts();

  const resetState = () => {
    setParsedForecasts([]);
    setStats(EMPTY_STATS);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({
        variant: "destructive",
        title: "Archivo invalido",
        description: "Selecciona un archivo Excel (.xlsx o .xls).",
      });
      return;
    }

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const parsedRows: ParsedForecast[] = [];
      let scannedRows = 0;
      let invalidRows = 0;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null }) as Array<Record<string, unknown>>;

        for (const row of jsonData) {
          const dateValue = pickValue(row, ["fecha", "date", "dia", "day"]);
          const dateIso = parseDateValue(dateValue);
          if (!dateIso || !isReasonableForecastDate(dateIso)) {
            invalidRows += 1;
            continue;
          }

          const occupancyRaw = parseNumericValue(
            pickValue(row, ["confirmada", "ocupacion", "ocupacionhotel", "habs", "habitaciones"]) ?? 0,
          );
          const breakfastRaw = parseNumericValue(
            pickValue(row, ["desayunos", "breakfast", "breakfastpax", "paxdesayuno"]) ?? 0,
          );
          const halfBoardRaw = parseNumericValue(
            pickValue(row, ["cenas", "mediapension", "mp", "halfboard"]) ?? 0,
          );
          const extrasRaw = parseNumericValue(
            pickValue(row, ["comidas", "extras", "lunch", "almuerzos"]) ?? 0,
          );

          const occupancy = clampPax(occupancyRaw);
          const breakfasts = clampPax(breakfastRaw);
          const halfBoard = clampPax(halfBoardRaw);
          const extras = clampPax(extrasRaw);

          if ([occupancy, breakfasts, halfBoard, extras].some((value) => value === null)) {
            invalidRows += 1;
            continue;
          }

          scannedRows += 1;
          parsedRows.push({
            forecast_date: dateIso,
            hotel_occupancy: occupancy ?? 0,
            breakfast_pax: breakfasts ?? 0,
            half_board_pax: halfBoard ?? 0,
            extras_pax: extras ?? 0,
          });
        }
      }

      const deduped = dedupeForecastsByDate(parsedRows);
      const nextStats: ImportStats = {
        scannedRows,
        validRows: deduped.rows.length,
        invalidRows,
        duplicatesMerged: deduped.duplicates,
      };

      setParsedForecasts(deduped.rows);
      setStats(nextStats);
      toast({
        title: "Archivo procesado",
        description:
          `Validos: ${nextStats.validRows}. ` +
          `Invalidos: ${nextStats.invalidRows}. ` +
          `Duplicados fusionados: ${nextStats.duplicatesMerged}.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error al procesar",
        description: error instanceof Error ? error.message : "No se pudo leer el archivo.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    await bulkUpsert.mutateAsync(parsedForecasts);
    setOpen(false);
    resetState();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar ocupacion
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Importar prevision de ocupacion</DialogTitle>
          <DialogDescription>
            Valida fechas y cantidades, deduplica por fecha y reemplaza la previson existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Seleccionar archivo Excel</Label>
            <div className="flex items-center gap-2">
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
              Columnas detectadas por alias: fecha, ocupacion/habs, desayunos, cenas/mp, extras/comidas.
            </p>
          </div>

          {parsedForecasts.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Escaneadas: {stats.scannedRows}</Badge>
                <Badge variant="secondary">Validas: {stats.validRows}</Badge>
                <Badge variant="outline">Invalidas: {stats.invalidRows}</Badge>
                <Badge variant="outline">Duplicados fusionados: {stats.duplicatesMerged}</Badge>
              </div>

              <ScrollArea className="h-64 rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Ocupacion</TableHead>
                      <TableHead className="text-right">Desayunos</TableHead>
                      <TableHead className="text-right">MP</TableHead>
                      <TableHead className="text-right">Extras</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedForecasts.slice(0, 40).map((forecast, idx) => (
                      <TableRow key={`${forecast.forecast_date}-${idx}`}>
                        <TableCell className="font-medium">
                          {new Date(`${forecast.forecast_date}T00:00:00`).toLocaleDateString("es-ES", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
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
                {parsedForecasts.length > 40 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    ... y {parsedForecasts.length - 40} dias mas
                  </p>
                )}
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetState}>
                  Limpiar
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
                  Importar {parsedForecasts.length} dias
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
