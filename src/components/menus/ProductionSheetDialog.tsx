import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Printer, Users } from "lucide-react";
import { useEvents } from "@/hooks/useEvents";
import { MenuWithItems } from "@/hooks/useMenus";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  menu: MenuWithItems | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductionSheetDialog({ menu, open, onOpenChange }: Props) {
  const [paxCount, setPaxCount] = useState<number>(10);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Fetch upcoming events
  const { data: events = [] } = useEvents({
    startDate: new Date().toISOString().split("T")[0],
  });

  // Filter events that have this menu assigned
  const eventsWithMenu = events.filter((e) => e.menu_id === menu?.id);

  // When event is selected, update pax count
  const handleEventSelect = (eventId: string) => {
    setSelectedEventId(eventId);
    const event = events.find((e) => e.id === eventId);
    if (event) {
      setPaxCount(event.pax);
    }
  };

  // Calculate scaled quantities
  const scaledItems = useMemo(() => {
    if (!menu) return [];

    return menu.menu_items.map((item) => {
      const product = item.product;
      const unitAbbr = product?.unit?.abbreviation || "uds";
      const totalQuantity = item.quantity_per_pax * paxCount;
      const totalCost = (product?.cost_price || 0) * totalQuantity;

      return {
        id: item.id,
        productName: product?.name || "Producto desconocido",
        quantityPerPax: item.quantity_per_pax,
        unit: unitAbbr,
        totalQuantity,
        costPerUnit: product?.cost_price || 0,
        totalCost,
      };
    });
  }, [menu, paxCount]);

  // Totals
  const totalCost = scaledItems.reduce((sum, item) => sum + item.totalCost, 0);
  const costPerPax = paxCount > 0 ? totalCost / paxCount : 0;

  const handlePrint = () => {
    window.print();
  };

  if (!menu) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:h-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Hoja de Producción
          </DialogTitle>
          <DialogDescription>
            {menu.name} — Cantidades escaladas para producción
          </DialogDescription>
        </DialogHeader>

        {/* Config section */}
        <div className="grid gap-4 sm:grid-cols-2 p-4 rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label htmlFor="pax-count" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Número de pax
            </Label>
            <Input
              id="pax-count"
              type="number"
              min="1"
              value={paxCount}
              onChange={(e) => setPaxCount(parseInt(e.target.value) || 0)}
              className="max-w-[120px]"
            />
          </div>

          {eventsWithMenu.length > 0 && (
            <div className="space-y-2">
              <Label>O selecciona un evento</Label>
              <Select value={selectedEventId} onValueChange={handleEventSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Cargar pax de evento..." />
                </SelectTrigger>
                <SelectContent>
                  {eventsWithMenu.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} — {format(new Date(event.event_date), "d MMM", { locale: es })} ({event.pax} pax)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Ingredients table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ingrediente</TableHead>
                <TableHead className="text-right">Por pax</TableHead>
                <TableHead className="text-right">Total ({paxCount} pax)</TableHead>
                <TableHead className="text-right">€/ud</TableHead>
                <TableHead className="text-right">Coste total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scaledItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No hay ingredientes en esta receta
                  </TableCell>
                </TableRow>
              ) : (
                scaledItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.quantityPerPax} {item.unit}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.totalQuantity.toFixed(2)} {item.unit}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {item.costPerUnit.toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right">
                      {item.totalCost.toFixed(2)} €
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-primary/10">
          <div>
            <p className="text-sm text-muted-foreground">Coste por porción</p>
            <p className="text-xl font-bold text-primary">{costPerPax.toFixed(2)} €</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Coste total ({paxCount} pax)</p>
            <p className="text-2xl font-bold">{totalCost.toFixed(2)} €</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 print:hidden">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
