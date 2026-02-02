import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  ShoppingCart, 
  Plus, 
  FileText, 
  Check, 
  Clock, 
  Truck,
  Edit2,
  Trash2,
  Loader2,
  Package,
  Send,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  usePurchases,
  usePurchaseStats,
  useCreatePurchase,
  useUpdatePurchase,
  useDeletePurchase,
  useReceivePurchase,
  usePendingDeliveries,
  PurchaseWithRelations,
} from "@/hooks/usePurchases";
import { useSuppliers, useProducts } from "@/hooks/useProducts";
import { calculateExpectedDelivery } from "@/hooks/useSuppliers";
import { PurchaseReceiveDialog } from "@/components/purchases/PurchaseReceiveDialog";

const statusConfig = {
  draft: { label: "Borrador", icon: FileText, color: "bg-muted text-muted-foreground" },
  pending: { label: "Pendiente", icon: Clock, color: "bg-warning/10 text-warning" },
  ordered: { label: "Pedido", icon: Truck, color: "bg-info/10 text-info" },
  received: { label: "Recibido", icon: Check, color: "bg-success/10 text-success" },
};

const Purchases = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [receivingPurchase, setReceivingPurchase] = useState<PurchaseWithRelations | null>(null);

  const [formData, setFormData] = useState({
    supplier_id: "",
    expected_date: "",
    notes: "",
  });

  const { data: purchases = [], isLoading } = usePurchases({ status: statusFilter });
  const { data: stats } = usePurchaseStats();
  const { data: suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProducts();
  const { data: pendingDeliveries } = usePendingDeliveries();

  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const deletePurchase = useDeletePurchase();
  const receivePurchase = useReceivePurchase();

  // Group purchases by supplier
  const purchasesBySupplier = purchases.reduce((acc, purchase) => {
    const supplierId = purchase.supplier_id;
    const supplierName = purchase.supplier?.name || "Sin proveedor";
    if (!acc[supplierId]) {
      acc[supplierId] = {
        name: supplierName,
        supplier: purchase.supplier,
        purchases: [],
        totalAmount: 0,
      };
    }
    acc[supplierId].purchases.push(purchase);
    acc[supplierId].totalAmount += purchase.total_amount || 0;
    return acc;
  }, {} as Record<string, { name: string; supplier?: PurchaseWithRelations["supplier"]; purchases: PurchaseWithRelations[]; totalAmount: number }>);

  // Get products for a supplier
  const getSupplierProducts = (supplierId: string) => {
    return products.filter(p => p.supplier_id === supplierId);
  };

  const resetForm = () => {
    setFormData({
      supplier_id: "",
      expected_date: "",
      notes: "",
    });
  };

  const handleOpenCreate = (supplierId?: string) => {
    resetForm();
    if (supplierId) {
      // Auto-calculate expected date based on supplier config
      const supplier = suppliers.find(s => s.id === supplierId);
      if (supplier) {
        const fullSupplier = purchases.find(p => p.supplier_id === supplierId)?.supplier;
        const deliveryDays = fullSupplier?.delivery_days || [];
        const leadDays = fullSupplier?.delivery_lead_days || 1;
        
        if (deliveryDays.length > 0) {
          const expectedDate = calculateExpectedDelivery(new Date(), deliveryDays, leadDays);
          if (expectedDate) {
            setFormData(prev => ({ 
              ...prev, 
              supplier_id: supplierId,
              expected_date: format(expectedDate, "yyyy-MM-dd")
            }));
            setIsCreateOpen(true);
            return;
          }
        }
      }
      setFormData(prev => ({ ...prev, supplier_id: supplierId }));
    }
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (purchase: PurchaseWithRelations) => {
    setFormData({
      supplier_id: purchase.supplier_id,
      expected_date: purchase.expected_date || "",
      notes: purchase.notes || "",
    });
    setEditingPurchase(purchase);
  };

  const handleSubmit = async () => {
    const data = {
      supplier_id: formData.supplier_id,
      expected_date: formData.expected_date || null,
      notes: formData.notes || null,
    };

    if (editingPurchase) {
      await updatePurchase.mutateAsync({ id: editingPurchase.id, ...data });
      setEditingPurchase(null);
    } else {
      await createPurchase.mutateAsync(data);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deletePurchase.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleStatusChange = async (purchase: PurchaseWithRelations, newStatus: string) => {
    if (newStatus === "received") {
      setReceivingPurchase(purchase);
    } else {
      await updatePurchase.mutateAsync({ id: purchase.id, status: newStatus });
    }
  };

  const handleReceive = async (data: { is_complete: boolean; delivery_issues?: string; delivery_note_url?: string }) => {
    if (!receivingPurchase) return;
    await receivePurchase.mutateAsync({
      id: receivingPurchase.id,
      ...data,
    });
    setReceivingPurchase(null);
  };

  const getDeliveryStatusBadge = (purchase: PurchaseWithRelations) => {
    if (purchase.status !== "ordered") return null;
    
    if (!purchase.expected_date) return null;
    
    const daysUntil = differenceInDays(new Date(purchase.expected_date), new Date());
    
    if (daysUntil < 0) {
      return (
        <Badge variant="destructive" className="text-xs gap-1">
          <AlertTriangle className="h-3 w-3" />
          {Math.abs(daysUntil)}d tarde
        </Badge>
      );
    } else if (daysUntil === 0) {
      return (
        <Badge className="bg-info/10 text-info border-info/20 text-xs gap-1">
          <Truck className="h-3 w-3" />
          Hoy
        </Badge>
      );
    }
    return null;
  };

  const lateCount = pendingDeliveries?.late?.length || 0;
  const todayCount = pendingDeliveries?.today?.length || 0;

  return (
    <MainLayout 
      title="Compras" 
      subtitle="Pedidos a proveedores agrupados"
    >
      {/* Alerts */}
      {(lateCount > 0 || todayCount > 0) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {lateCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                {lateCount} pedido{lateCount > 1 ? "s" : ""} retrasado{lateCount > 1 ? "s" : ""}
              </span>
            </div>
          )}
          {todayCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-info/30 bg-info/5">
              <Truck className="h-4 w-4 text-info" />
              <span className="text-sm font-medium text-info">
                {todayCount} entrega{todayCount > 1 ? "s" : ""} prevista{todayCount > 1 ? "s" : ""} hoy
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Borradores</p>
          <p className="font-display text-2xl font-semibold mt-1">{stats?.draftCount || 0}</p>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="font-display text-2xl font-semibold mt-1 text-warning">{stats?.pendingCount || 0}</p>
        </div>
        <div className="rounded-xl border border-info/30 bg-info/5 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Pedidos</p>
          <p className="font-display text-2xl font-semibold mt-1 text-info">{stats?.orderedCount || 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total pedido</p>
          <p className="font-display text-2xl font-semibold mt-1">
            €{(stats?.totalAmount || 0).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Borradores</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="ordered">Pedidos</SelectItem>
              <SelectItem value="received">Recibidos</SelectItem>
            </SelectContent>
          </Select>

          <Link to="/suppliers">
            <Button variant="outline" size="sm" className="h-9">
              <Building2 className="h-4 w-4 mr-2" />
              Proveedores
            </Button>
          </Link>
        </div>

        <Button size="sm" className="h-9" onClick={() => handleOpenCreate()}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Pedido
        </Button>
      </div>

      {/* Purchases by Supplier */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : Object.keys(purchasesBySupplier).length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No hay pedidos. Crea uno nuevo para empezar.</p>
        </div>
      ) : (
        <Accordion type="multiple" defaultValue={Object.keys(purchasesBySupplier)} className="space-y-4">
          {Object.entries(purchasesBySupplier).map(([supplierId, { name, supplier, purchases: supplierPurchases, totalAmount }]) => (
            <AccordionItem 
              key={supplierId} 
              value={supplierId}
              className="rounded-2xl border border-border bg-card shadow-sm"
            >
              <AccordionTrigger className="px-4 hover:no-underline">
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium">{name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{supplierPurchases.length} pedidos • €{totalAmount.toFixed(2)}</span>
                      {supplier?.delivery_days && supplier.delivery_days.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          <Calendar className="h-3 w-3 mr-1" />
                          {supplier.delivery_lead_days || 1}d plazo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mr-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenCreate(supplierId);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Nuevo pedido
                </Button>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                {/* Show supplier's products */}
                {getSupplierProducts(supplierId).length > 0 && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">
                      Productos de este proveedor:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {getSupplierProducts(supplierId).slice(0, 10).map(p => (
                        <Badge key={p.id} variant="secondary" className="text-xs">
                          {p.name}
                        </Badge>
                      ))}
                      {getSupplierProducts(supplierId).length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{getSupplierProducts(supplierId).length - 10} más
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Purchases table */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha pedido</TableHead>
                      <TableHead>Entrega prevista</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Entrega</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supplierPurchases.map((purchase) => {
                      const status = statusConfig[purchase.status as keyof typeof statusConfig] || statusConfig.draft;
                      const StatusIcon = status.icon;
                      
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell className="text-muted-foreground">
                            {format(parseISO(purchase.order_date), "d MMM yyyy", { locale: es })}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-2">
                              {purchase.expected_date 
                                ? format(parseISO(purchase.expected_date), "d MMM yyyy", { locale: es })
                                : "—"
                              }
                              {getDeliveryStatusBadge(purchase)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select 
                              value={purchase.status || "draft"} 
                              onValueChange={(v) => handleStatusChange(purchase, v)}
                            >
                              <SelectTrigger className={cn("w-32 h-8", status.color)}>
                                <div className="flex items-center gap-1.5">
                                  <StatusIcon className="h-3.5 w-3.5" />
                                  <span className="text-xs">{status.label}</span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="draft">Borrador</SelectItem>
                                <SelectItem value="pending">Pendiente</SelectItem>
                                <SelectItem value="ordered">Pedido</SelectItem>
                                <SelectItem value="received">Recibido</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {purchase.status === "received" && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "text-xs",
                                  purchase.is_complete 
                                    ? "bg-success/10 text-success border-success/20" 
                                    : "bg-destructive/10 text-destructive border-destructive/20"
                                )}
                              >
                                {purchase.is_complete ? (
                                  <><CheckCircle2 className="h-3 w-3 mr-1" /> Completo</>
                                ) : (
                                  <><AlertTriangle className="h-3 w-3 mr-1" /> Incompleto</>
                                )}
                              </Badge>
                            )}
                            {purchase.status === "ordered" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setReceivingPurchase(purchase)}
                              >
                                <Package className="h-3 w-3 mr-1" />
                                Recibir
                              </Button>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            €{(purchase.total_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => handleOpenEdit(purchase)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => setDeleteId(purchase.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Quick supplier list for new orders */}
      {suppliers.length > 0 && purchases.length === 0 && (
        <div className="mt-8">
          <h3 className="font-display text-lg font-semibold mb-4">Proveedores disponibles</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => {
              const supplierProducts = getSupplierProducts(supplier.id);
              return (
                <div
                  key={supplier.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-medium">{supplier.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {supplierProducts.length} productos
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCreate(supplier.id)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Pedir
                    </Button>
                  </div>
                  {supplierProducts.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {supplierProducts.slice(0, 5).map(p => (
                        <Badge key={p.id} variant="secondary" className="text-xs">
                          {p.name}
                        </Badge>
                      ))}
                      {supplierProducts.length > 5 && (
                        <Badge variant="outline" className="text-xs">
                          +{supplierProducts.length - 5}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingPurchase} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingPurchase(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPurchase ? "Editar Pedido" : "Nuevo Pedido"}</DialogTitle>
            <DialogDescription>
              {editingPurchase ? "Modifica los datos del pedido" : "Crea un nuevo pedido a proveedor"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier">Proveedor *</Label>
              <Select 
                value={formData.supplier_id} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, supplier_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar proveedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="expected_date">Fecha entrega prevista</Label>
              <Input
                id="expected_date"
                type="date"
                value={formData.expected_date}
                onChange={(e) => setFormData(prev => ({ ...prev, expected_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Observaciones del pedido..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingPurchase(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.supplier_id || createPurchase.isPending || updatePurchase.isPending}
            >
              {(createPurchase.isPending || updatePurchase.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPurchase ? "Guardar cambios" : "Crear pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      {receivingPurchase && (
        <PurchaseReceiveDialog
          open={!!receivingPurchase}
          onOpenChange={(open) => !open && setReceivingPurchase(null)}
          purchaseId={receivingPurchase.id}
          supplierName={receivingPurchase.supplier?.name || "Proveedor"}
          expectedItems={receivingPurchase.items?.map(i => ({
            id: i.id,
            name: i.product?.name || "Producto",
            quantity: i.quantity,
          })) || []}
          onReceive={handleReceive}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el pedido y todos sus artículos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePurchase.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Purchases;
