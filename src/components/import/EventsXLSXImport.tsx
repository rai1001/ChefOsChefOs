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
import { Badge } from "@/components/ui/badge";
import * as XLSX from "xlsx";
import { useBulkInsertEvents, useVenues } from "@/hooks/useEvents";

interface ParsedEvent {
  name: string;
  event_date: string;
  venue: string;
  pax?: number;
  notes?: string;
}

const MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const VENUES = ['ROSALIA', 'PONDAL', 'CASTELAO', 'CURROS', 'CUNQUEIRO', 'HALL', 'RESTAURANTE', 'BAR'];

export function EventsXLSXImport() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const bulkInsert = useBulkInsertEvents();
  const { data: venues } = useVenues();

  const extractPax = (text: string): number | undefined => {
    const paxMatch = text.match(/(\d+)\s*(?:PAX|pax|Pax)/i);
    return paxMatch ? parseInt(paxMatch[1]) : undefined;
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
      
      const events: ParsedEvent[] = [];
      const sheetStats: string[] = [];
      
      // Try to extract year from filename - PRIORITIZE file year over current year
      let defaultYear: number | null = null;
      const yearMatch = file.name.match(/20\d{2}/);
      if (yearMatch) {
        defaultYear = parseInt(yearMatch[0]);
      }
      
      // If no year in filename, scan all sheet names and first rows for a year
      if (!defaultYear) {
        for (const sheetName of workbook.SheetNames) {
          const sheetYearMatch = sheetName.match(/20\d{2}/);
          if (sheetYearMatch) {
            defaultYear = parseInt(sheetYearMatch[0]);
            break;
          }
          // Also check first few rows of the sheet for year
          const worksheet = workbook.Sheets[sheetName];
          const preview = XLSX.utils.sheet_to_json(worksheet, { header: 1, range: 0 }) as (string | number)[][];
          for (const row of preview.slice(0, 10)) {
            const rowStr = row.join(' ');
            const rowYearMatch = rowStr.match(/20\d{2}/);
            if (rowYearMatch) {
              defaultYear = parseInt(rowYearMatch[0]);
              break;
            }
          }
          if (defaultYear) break;
        }
      }
      
      // If still no year found, use current year as fallback
      if (!defaultYear) {
        defaultYear = new Date().getFullYear();
        console.warn('No year found in file, using current year:', defaultYear);
      }

      console.log('Default year detected:', defaultYear);

      // Process ALL sheets in the workbook
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];

        let currentMonth = '';
        let currentYear = defaultYear;
        let sheetEventCount = 0;
        
        // Try to extract year from sheet name (e.g., "Q1 2025", "1T 2025", "2025")
        const sheetYearMatch = sheetName.match(/20\d{2}/);
        if (sheetYearMatch) {
          currentYear = parseInt(sheetYearMatch[0]);
        }
        
        console.log(`Processing sheet "${sheetName}" with year ${currentYear}`);
        
        for (const row of jsonData) {
          if (!row || row.length < 2) continue;

          const firstCell = String(row[0] || '').trim().toUpperCase();

          // Check if this is a month header row - support various formats
          let monthIndex = MONTHS.indexOf(firstCell);
          
          // Also try partial match (e.g., "ENERO 2025" or just first letters)
          if (monthIndex === -1) {
            for (let i = 0; i < MONTHS.length; i++) {
              if (firstCell.startsWith(MONTHS[i]) || MONTHS[i].startsWith(firstCell.slice(0, 3))) {
                monthIndex = i;
                break;
              }
            }
          }
          
          // Check if row contains year info
          const rowYearMatch = firstCell.match(/20\d{2}/);
          if (rowYearMatch) {
            currentYear = parseInt(rowYearMatch[0]);
          }
          
          if (monthIndex !== -1) {
            currentMonth = MONTHS[monthIndex];
            continue;
          }

          // Parse day number - handle various formats
          let dayNum: number | null = null;
          const firstCellStr = String(row[0] || '');
          
          // Try parsing as number directly
          const parsed = parseInt(firstCellStr);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) {
            dayNum = parsed;
          }
          
          // Try parsing as date (Excel serial number)
          if (dayNum === null && typeof row[0] === 'number' && row[0] > 40000) {
            // Excel serial date - convert to JS date
            const excelDate = new Date((row[0] - 25569) * 86400 * 1000);
            if (!isNaN(excelDate.getTime())) {
              dayNum = excelDate.getDate();
              currentMonth = MONTHS[excelDate.getMonth()];
              currentYear = excelDate.getFullYear();
            }
          }
          
          if (dayNum === null || !currentMonth) continue;

          // Process each venue column
          for (let col = 1; col < row.length && col <= VENUES.length; col++) {
            const cellValue = String(row[col] || '').trim();
            if (!cellValue || cellValue === 'FESTIVO' || cellValue.startsWith('OUT ')) continue;

            const venue = VENUES[col - 1];
            const monthNum = MONTHS.indexOf(currentMonth) + 1;
            const dateStr = `${currentYear}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

            events.push({
              name: cellValue,
              event_date: dateStr,
              venue: venue,
              pax: extractPax(cellValue),
              notes: cellValue,
            });
            sheetEventCount++;
          }
        }
        
        sheetStats.push(`${sheetName}: ${sheetEventCount} eventos`);
      }

      // Sort by date
      events.sort((a, b) => a.event_date.localeCompare(b.event_date));

      setParsedEvents(events);
      
      console.log('Hojas procesadas:', sheetStats);
      
      toast({
        title: "Archivo procesado",
        description: `${events.length} eventos en ${workbook.SheetNames.length} hojas: ${workbook.SheetNames.join(', ')}`,
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

  const findVenueId = (venueName: string): string | null => {
    if (!venues) return null;
    const venue = venues.find(v => v.name.toUpperCase() === venueName.toUpperCase());
    return venue?.id || null;
  };

  const handleConfirmImport = async () => {
    const eventsToInsert = parsedEvents.map(e => ({
      name: e.name,
      event_date: e.event_date,
      venue_id: findVenueId(e.venue),
      pax: e.pax || 0,
      notes: e.notes,
      status: 'confirmed' as const,
    }));

    await bulkInsert.mutateAsync(eventsToInsert);
    setOpen(false);
    setParsedEvents([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar Planning
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Importar Planning de Eventos</DialogTitle>
          <DialogDescription>
            Importa un planning en Excel para convertirlo en eventos del calendario.
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
                disabled={loading || bulkInsert.isPending}
              />
              {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Formato esperado: matriz con meses (ENERO, FEBRERO...) y salones (ROSALIA, PONDAL, CASTELAO...)
            </p>
          </div>

          {parsedEvents.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                Vista previa: {parsedEvents.length} eventos encontrados
              </div>
              <ScrollArea className="h-64 rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Salón</TableHead>
                      <TableHead className="text-right">PAX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedEvents.slice(0, 50).map((event, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {new Date(event.event_date).toLocaleDateString('es-ES', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short'
                          })}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {event.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {event.venue}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {event.pax || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedEvents.length > 50 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    ... y {parsedEvents.length - 50} eventos más
                  </p>
                )}
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setParsedEvents([])}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmImport} 
                  className="gap-2"
                  disabled={bulkInsert.isPending}
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
