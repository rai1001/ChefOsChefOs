import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, 
  Search, 
  Warehouse, 
  AlertTriangle, 
  Calendar,
  MapPin,
  Package,
  Edit2,
  Trash2,
  Loader2,
  FileText,
  Barcode,
  ArrowDownToLine,
  ArrowUpFromLine
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  useInventoryLots,
  useInventoryStats,
  useCreateInventoryLot,
  useUpdateInventoryLot,
  useDeleteInventoryLot,
  InventoryLotWithRelations,
} from "@/hooks/useInventory";
import { useProducts } from "@/hooks/useProducts";
import { useSuppliers } from "@/hooks/useProducts";
import { DeliveryNoteImport } from "@/components/inventory/DeliveryNoteImport";
import { BarcodeScanner } from "@/components/inventory/BarcodeScanner";

type FilterType = "all" | "expiring" | "critical";

const Inventory = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingLot, setEditingLot] = useState<InventoryLotWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isOCROpen, setIsOCROpen] = useState(false);
  const [scanMode, setScanMode] = useState<"entry" | "exit" | null>(null);

  const [formData, setFormData] = useState({
    product_id: "",
    quantity: "",
    lot_number: "",
    expiry_date: "",
    location: "",
    cost_per_unit: "",
    supplier_id: "",
    notes: "",
    barcode: "",
  });

  const { data: lots = [], isLoading } = useInventoryLots();
  const { data: stats } = useInventoryStats();
  const { data: products = [] } = useProducts();
  const { data: suppliers = [] } = useSuppliers();

  const createLot = useCreateInventoryLot();
  const updateLot = useUpdateInventoryLot();
  const deleteLot = useDeleteInventoryLot();

  const getDaysUntilExpiry = (expiryDate: string | null) => {
    if (!expiryDate) return Infinity;
    return differenceInDays(parseISO(expiryDate), new Date());
  };

  const filteredLots = lots.filter(lot => {
    const matchesSearch = 
      lot.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lot.location?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    const daysUntil = getDaysUntilExpiry(lot.expiry_date);
    if (filter === "critical") return daysUntil <= 3;
    if (filter === "expiring") return daysUntil <= 7;
    return true;
  });

  const resetForm = () => {
    setFormData({
      product_id: "",
      quantity: "",
      lot_number: "",
      expiry_date: "",
      location: "",
      cost_per_unit: "",
      supplier_id: "",
      notes: "",
      barcode: "",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (lot: InventoryLotWithRelations) => {
    setFormData({
      product_id: lot.product_id,
      quantity: lot.quantity.toString(),
      lot_number: lot.lot_number || "",
      expiry_date: lot.expiry_date || "",
      location: lot.location || "",
      cost_per_unit: lot.cost_per_unit?.toString() || "",
      supplier_id: lot.supplier_id || "",
      notes: lot.notes || "",
      barcode: lot.barcode || "",
    });
    setEditingLot(lot);
  };

  const handleSubmit = async () => {
    const data = {
      product_id: formData.product_id,
      quantity: parseFloat(formData.quantity),
      lot_number: formData.lot_number || null,
      expiry_date: formData.expiry_date || null,
      location: formData.location || null,
      cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
      supplier_id: formData.supplier_id || null,
      notes: formData.notes || null,
      barcode: formData.barcode || null,
    };

    if (editingLot) {
      await updateLot.mutateAsync({ id: editingLot.id, ...data });
      setEditingLot(null);
    } else {
      await createLot.mutateAsync(data);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteLot.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <MainLayout 
      title="Inventario" 
      subtitle="Control de lotes y caducidades"
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Warehouse className="h-4 w-4" />
            Total lotes
          </div>
          <p className="font-display text-2xl font-semibold">{stats?.totalLots || 0}</p>
        </div>
        
        <div className={cn(
          "rounded-xl border p-4 shadow-sm",
          (stats?.criticalCount || 0) > 0 ? "border-destructive/30 bg-destructive/5" : "border-border bg-card"
        )}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <AlertTriangle className={cn("h-4 w-4", (stats?.criticalCount || 0) > 0 && "text-destructive")} />
            Crítico (≤3d)
          </div>
          <p className={cn("font-display text-2xl font-semibold", (stats?.criticalCount || 0) > 0 && "text-destructive")}>
            {stats?.criticalCount || 0}
          </p>
        </div>
        
        <div className={cn(
          "rounded-xl border p-4 shadow-sm",
          (stats?.expiringCount || 0) > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"
        )}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Calendar className="h-4 w-4" />
            Próximos (≤7d)
          </div>
          <p className={cn("font-display text-2xl font-semibold", (stats?.expiringCount || 0) > 0 && "text-warning")}>
            {stats?.expiringCount || 0}
          </p>
        </div>
        
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="h-4 w-4" />
            Ubicaciones
          </div>
          <p className="font-display text-2xl font-semibold">{stats?.uniqueLocations || 0}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto o ubicación..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => setFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={filter === "expiring" ? "default" : "outline"}
              size="sm"
              className={cn("h-9", filter === "expiring" && "bg-warning hover:bg-warning/90")}
              onClick={() => setFilter("expiring")}
            >
              Próximos ≤7d
            </Button>
            <Button
              variant={filter === "critical" ? "default" : "outline"}
              size="sm"
              className={cn("h-9", filter === "critical" && "bg-destructive hover:bg-destructive/90")}
              onClick={() => setFilter("critical")}
            >
              Críticos ≤3d
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setIsOCROpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Importar Albarán
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setScanMode("entry")}>
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            Entrada
          </Button>
          <Button variant="outline" size="sm" className="h-9 text-warning border-warning/30 hover:bg-warning/10" onClick={() => setScanMode("exit")}>
            <ArrowUpFromLine className="h-4 w-4 mr-2" />
            Salida
          </Button>
          <Button size="sm" className="h-9" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Lote
          </Button>
        </div>
      </div>

      {/* Lots Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : filteredLots.length === 0 ? (
          <div className="col-span-full flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
            <p className="text-muted-foreground">
              {lots.length === 0 ? "No hay lotes en inventario" : "No se encontraron lotes"}
            </p>
          </div>
        ) : (
          filteredLots.map((lot, index) => {
            const daysUntil = getDaysUntilExpiry(lot.expiry_date);
            const isCritical = daysUntil <= 3;
            const isExpiring = daysUntil <= 7;
            
            return (
              <div 
                key={lot.id}
                className={cn(
                  "rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md animate-fade-in",
                  isCritical && "border-destructive/30 bg-destructive/5",
                  isExpiring && !isCritical && "border-warning/30 bg-warning/5"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      isCritical ? "bg-destructive/10 text-destructive" :
                      isExpiring ? "bg-warning/10 text-warning" :
                      "bg-primary/10 text-primary"
                    )}>
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-medium">{lot.product?.name || "Producto"}</h4>
                      <p className="text-xs text-muted-foreground">{lot.location || "Sin ubicación"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge 
                      variant="outline"
                      className={cn(
                        "text-xs",
                        isCritical 
                          ? "bg-destructive/10 text-destructive border-destructive/20" 
                          : isExpiring
                          ? "bg-warning/10 text-warning border-warning/20"
                          : ""
                      )}
                    >
                      {daysUntil <= 0 ? "¡Caducado!" : daysUntil === Infinity ? "Sin fecha" : `${daysUntil}d`}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Cantidad</p>
                    <p className="font-medium">{lot.quantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Caduca</p>
                    <p className="font-medium">
                      {lot.expiry_date 
                        ? format(parseISO(lot.expiry_date), "d MMM yyyy", { locale: es })
                        : "—"
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                  {lot.lot_number ? (
                    <p className="text-xs text-muted-foreground">
                      Lote: <span className="font-mono">{lot.lot_number}</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7"
                      onClick={() => handleOpenEdit(lot)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-7 w-7 text-destructive"
                      onClick={() => setDeleteId(lot.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingLot} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingLot(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLot ? "Editar Lote" : "Nuevo Lote"}</DialogTitle>
            <DialogDescription>
              {editingLot ? "Modifica los datos del lote" : "Registra un nuevo lote en inventario"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="product">Producto *</Label>
              <Select 
                value={formData.product_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, product_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar producto..." />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="quantity">Cantidad *</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lot_number">Nº Lote</Label>
                <Input
                  id="lot_number"
                  value={formData.lot_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, lot_number: e.target.value }))}
                  placeholder="LOT-001"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="expiry_date">Fecha caducidad</Label>
                <Input
                  id="expiry_date"
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="location">Ubicación</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Cámara 1, Estante A"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cost">Coste unitario (€)</Label>
                <Input
                  id="cost"
                  type="number"
                  step="0.01"
                  value={formData.cost_per_unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_per_unit: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplier">Proveedor</Label>
                <Select 
                  value={formData.supplier_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, supplier_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="barcode">Código de barras</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                placeholder="Escanear o escribir código..."
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingLot(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.product_id || !formData.quantity || createLot.isPending || updateLot.isPending}
            >
              {(createLot.isPending || updateLot.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingLot ? "Guardar cambios" : "Crear lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el lote del inventario permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteLot.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* OCR Import Dialog */}
      <DeliveryNoteImport open={isOCROpen} onOpenChange={setIsOCROpen} />

      {/* Barcode Scanner Dialog */}
      {scanMode && (
        <BarcodeScanner 
          open={!!scanMode} 
          onOpenChange={(open) => !open && setScanMode(null)} 
          mode={scanMode}
        />
      )}
    </MainLayout>
  );
};

export default Inventory;
