import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { useBulkInsertEvents, useVenues } from "@/hooks/useEvents";
import {
  type EventStatusNormalized,
  type EventTypeNormalized,
  normalizeEventInsert,
  normalizeEventStatus,
} from "@/lib/eventNormalization";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import * as XLSX from "xlsx";

interface ParsedEventPreview {
  name: string;
  event_date: string;
  venue: string;
  status: EventStatusNormalized;
  event_type: EventTypeNormalized;
  pax: number;
  pax_estimated: number;
  pax_confirmed: number;
  notes: string | null;
}

interface ImportStats {
  scannedRows: number;
  validRows: number;
  invalidRows: number;
  dedupedRows: number;
  unresolvedVenues: number;
}

const MONTHS = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

const VENUES = ["ROSALIA", "PONDAL", "CASTELAO", "CURROS", "CUNQUEIRO", "HALL", "RESTAURANTE", "BAR"];

const EMPTY_STATS: ImportStats = {
  scannedRows: 0,
  validRows: 0,
  invalidRows: 0,
  dedupedRows: 0,
  unresolvedVenues: 0,
};

function parseWorkbookYear(fileName: string, workbook: XLSX.WorkBook): number {
  const fileYear = fileName.match(/20\d{2}/)?.[0];
  if (fileYear) return Number(fileYear);

  for (const sheetName of workbook.SheetNames) {
    const sheetYear = sheetName.match(/20\d{2}/)?.[0];
    if (sheetYear) return Number(sheetYear);
  }

  return new Date().getFullYear();
}

function parseMonthToken(value: string): number {
  const token = value.trim().toUpperCase();
  if (!token) return -1;

  let index = MONTHS.indexOf(token);
  if (index !== -1) return index;

  index = MONTHS.findIndex((month) => token.startsWith(month) || month.startsWith(token.slice(0, 3)));
  return index;
}

function isValidDateParts(year: number, monthIndex: number, day: number): boolean {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return false;
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  if (monthIndex < 0 || monthIndex > 11) return false;
  const date = new Date(Date.UTC(year, monthIndex, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === monthIndex && date.getUTCDate() === day;
}

function buildDateIso(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDayCell(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (Number.isInteger(raw) && raw >= 1 && raw <= 31) return raw;
    if (raw > 40000 && raw < 90000) {
      const excelDate = new Date((raw - 25569) * 86400 * 1000);
      if (!Number.isNaN(excelDate.getTime())) return excelDate.getDate();
    }
    return null;
  }

  const text = String(raw ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 31) return parsed;
  return null;
}

function dedupeParsedEvents(rows: ParsedEventPreview[]): { rows: ParsedEventPreview[]; duplicates: number } {
  const map = new Map<string, ParsedEventPreview>();
  for (const row of rows) {
    const key = `${row.event_date}::${row.venue}::${row.name.toLowerCase()}`;
    map.set(key, row);
  }
  const dedupedRows = [...map.values()].sort((a, b) => {
    if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
    if (a.venue !== b.venue) return a.venue.localeCompare(b.venue);
    return a.name.localeCompare(b.name);
  });
  return {
    rows: dedupedRows,
    duplicates: Math.max(rows.length - dedupedRows.length, 0),
  };
}

function toHumanStatus(status: EventStatusNormalized): string {
  if (status === "draft") return "Borrador";
  if (status === "confirmed") return "Confirmado";
  return "Cancelado";
}

function toHumanType(type: EventTypeNormalized): string {
  if (type === "breakfast") return "Breakfast";
  if (type === "banquet") return "Banquete";
  if (type === "wedding") return "Boda";
  if (type === "corporate") return "Corporativo";
  if (type === "conference") return "Conferencia";
  if (type === "cocktail") return "Cocktail";
  return "Otro";
}

export function EventsXLSXImport() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ParsedEventPreview[]>([]);
  const [stats, setStats] = useState<ImportStats>(EMPTY_STATS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const bulkInsert = useBulkInsertEvents();
  const { data: venues = [] } = useVenues();

  const venueIdsByUpperName = useMemo(() => {
    const map = new Map<string, string>();
    for (const venue of venues) {
      map.set(venue.name.toUpperCase(), venue.id);
    }
    return map;
  }, [venues]);

  const findVenueId = (venueName: string): string | null => {
    return venueIdsByUpperName.get(venueName.toUpperCase()) ?? null;
  };

  const resetState = () => {
    setParsedEvents([]);
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
      const defaultYear = parseWorkbookYear(file.name, workbook);

      const parsedRows: ParsedEventPreview[] = [];
      let scannedRows = 0;
      let invalidRows = 0;

      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
        let currentMonth = -1;
        let currentYear = Number(sheetName.match(/20\d{2}/)?.[0] ?? defaultYear);

        for (const row of rows) {
          if (!row || row.length < 2) continue;

          const firstCellRaw = String(row[0] ?? "").trim();
          const firstCellUpper = firstCellRaw.toUpperCase();
          if (!firstCellUpper) continue;

          const maybeMonth = parseMonthToken(firstCellUpper);
          if (maybeMonth !== -1) {
            currentMonth = maybeMonth;
            const yearInToken = firstCellUpper.match(/20\d{2}/)?.[0];
            if (yearInToken) currentYear = Number(yearInToken);
            continue;
          }

          const day = parseDayCell(row[0]);
          if (day === null || currentMonth === -1) continue;
          if (!isValidDateParts(currentYear, currentMonth, day)) {
            invalidRows += 1;
            continue;
          }
          const dateIso = buildDateIso(currentYear, currentMonth, day);

          for (let col = 1; col < row.length && col <= VENUES.length; col += 1) {
            const rawCell = String(row[col] ?? "").trim();
            if (!rawCell) continue;
            if (rawCell.toUpperCase() === "FESTIVO" || rawCell.toUpperCase().startsWith("OUT ")) continue;

            scannedRows += 1;
            const venue = VENUES[col - 1];
            const guessedStatus = normalizeEventStatus(rawCell);

            const normalized = normalizeEventInsert({
              name: rawCell,
              event_date: dateIso,
              status: guessedStatus,
              notes: rawCell,
              pax: 0,
            });

            if (!normalized) {
              invalidRows += 1;
              continue;
            }

            parsedRows.push({
              name: normalized.name,
              event_date: normalized.event_date,
              venue,
              status: normalized.status,
              event_type: normalized.event_type,
              pax: normalized.pax,
              pax_estimated: normalized.pax_estimated,
              pax_confirmed: normalized.pax_confirmed,
              notes: normalized.notes,
            });
          }
        }
      }

      const deduped = dedupeParsedEvents(parsedRows);
      const unresolvedVenues = deduped.rows.filter((row) => !findVenueId(row.venue)).length;
      const computedStats: ImportStats = {
        scannedRows,
        validRows: deduped.rows.length,
        invalidRows,
        dedupedRows: deduped.duplicates,
        unresolvedVenues,
      };

      setParsedEvents(deduped.rows);
      setStats(computedStats);

      toast({
        title: "Archivo procesado",
        description:
          `Validos: ${computedStats.validRows}. ` +
          `Invalidos: ${computedStats.invalidRows}. ` +
          `Duplicados fusionados: ${computedStats.dedupedRows}.`,
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
    const eventsToInsert = parsedEvents.map((event) => ({
      name: event.name,
      event_date: event.event_date,
      venue_id: findVenueId(event.venue),
      pax: event.pax,
      pax_estimated: event.pax_estimated,
      pax_confirmed: event.pax_confirmed,
      event_type: event.event_type,
      status: event.status,
      notes: event.notes,
    }));

    await bulkInsert.mutateAsync(eventsToInsert);
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
          Importar planning
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Importar planning de eventos</DialogTitle>
          <DialogDescription>
            Valida fechas, deduplica por fecha/salon/nombre y normaliza estado, tipo y pax.
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
                disabled={loading || bulkInsert.isPending}
              />
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Formato esperado: meses + matriz de salones (Rosalia, Pondal, Castelao, Curros, Cunqueiro, Hall, Restaurante, Bar).
            </p>
          </div>

          {parsedEvents.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Escaneadas: {stats.scannedRows}</Badge>
                <Badge variant="secondary">Validas: {stats.validRows}</Badge>
                <Badge variant="outline">Invalidas: {stats.invalidRows}</Badge>
                <Badge variant="outline">Duplicados fusionados: {stats.dedupedRows}</Badge>
                {stats.unresolvedVenues > 0 && (
                  <Badge variant="destructive">Salones sin mapeo: {stats.unresolvedVenues}</Badge>
                )}
              </div>

              <ScrollArea className="h-72 rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Salon</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">PAX est.</TableHead>
                      <TableHead className="text-right">PAX conf.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedEvents.slice(0, 80).map((event, index) => (
                      <TableRow key={`${event.event_date}-${event.venue}-${event.name}-${index}`}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {new Date(`${event.event_date}T00:00:00`).toLocaleDateString("es-ES", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-sm max-w-sm truncate">{event.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {event.venue}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{toHumanType(event.event_type)}</TableCell>
                        <TableCell className="text-xs">{toHumanStatus(event.status)}</TableCell>
                        <TableCell className="text-right">{event.pax_estimated}</TableCell>
                        <TableCell className="text-right">{event.pax_confirmed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedEvents.length > 80 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    ... y {parsedEvents.length - 80} eventos mas
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
                  disabled={bulkInsert.isPending || parsedEvents.length === 0}
                >
                  {bulkInsert.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Importar {parsedEvents.length} eventos
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
