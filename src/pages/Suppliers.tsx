import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Building2,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSuppliersList,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  Supplier,
  SupplierInsert,
  DAYS_OF_WEEK,
} from "@/hooks/useSuppliers";

const Suppliers = () => {
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState<SupplierInsert>({
    name: "",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
    delivery_days: [],
    delivery_lead_days: 1,
  });

  const { data: suppliers = [], isLoading } = useSuppliersList();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const deleteSupplier = useDeleteSupplier();

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.is_active !== false &&
      (s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.contact_person?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const resetForm = () => {
    setFormData({
      name: "",
      contact_person: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      delivery_days: [],
      delivery_lead_days: 1,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      delivery_days: supplier.delivery_days || [],
      delivery_lead_days: supplier.delivery_lead_days || 1,
    });
    setEditingSupplier(supplier);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;

    const data = {
      name: formData.name.trim(),
      contact_person: formData.contact_person || null,
      email: formData.email || null,
      phone: formData.phone || null,
      address: formData.address || null,
      notes: formData.notes || null,
      delivery_days: formData.delivery_days || [],
      delivery_lead_days: formData.delivery_lead_days || 1,
    };

    if (editingSupplier) {
      await updateSupplier.mutateAsync({ id: editingSupplier.id, ...data });
      setEditingSupplier(null);
    } else {
      await createSupplier.mutateAsync(data);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteSupplier.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const toggleDeliveryDay = (day: string) => {
    const current = formData.delivery_days || [];
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    setFormData((prev) => ({ ...prev, delivery_days: updated }));
  };

  const getDayLabels = (days: string[] | null) => {
    if (!days || days.length === 0) return "No configurado";
    return days
      .map((d) => DAYS_OF_WEEK.find((dw) => dw.value === d)?.label || d)
      .join(", ");
  };

  return (
    <MainLayout title="Proveedores" subtitle="Gestión de proveedores y entregas">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar proveedores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total proveedores</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {filteredSuppliers.length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Con días configurados</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {filteredSuppliers.filter((s) => s.delivery_days && s.delivery_days.length > 0).length}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Promedio plazo entrega</p>
          <p className="font-display text-2xl font-semibold mt-1">
            {filteredSuppliers.length > 0
              ? (
                  filteredSuppliers.reduce((sum, s) => sum + (s.delivery_lead_days || 1), 0) /
                  filteredSuppliers.length
                ).toFixed(1)
              : 0}{" "}
            días
          </p>
        </div>
      </div>

      {/* Suppliers Table */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search ? "No se encontraron proveedores" : "No hay proveedores. Crea uno para empezar."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proveedor</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Días de reparto</TableHead>
                <TableHead>Plazo entrega</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{supplier.name}</p>
                        {supplier.contact_person && (
                          <p className="text-sm text-muted-foreground">{supplier.contact_person}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {supplier.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          {supplier.phone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5" />
                          {supplier.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {supplier.delivery_days && supplier.delivery_days.length > 0 ? (
                        supplier.delivery_days.map((day) => (
                          <Badge key={day} variant="secondary" className="text-xs">
                            {DAYS_OF_WEEK.find((d) => d.value === day)?.label.slice(0, 3) || day}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No configurado</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{supplier.delivery_lead_days || 1} días</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenEdit(supplier)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteId(supplier.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={isCreateOpen || !!editingSupplier}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingSupplier(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Proveedor" : "Nuevo Proveedor"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? "Modifica los datos del proveedor"
                : "Añade un nuevo proveedor al sistema"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del proveedor"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact_person">Persona de contacto</Label>
                <Input
                  id="contact_person"
                  value={formData.contact_person || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, contact_person: e.target.value }))
                  }
                  placeholder="Juan García"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="contacto@proveedor.com"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Calle, Ciudad, CP"
              />
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">Configuración de entregas</Label>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Días de reparto</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <div key={day.value} className="flex items-center gap-2">
                        <Checkbox
                          id={day.value}
                          checked={(formData.delivery_days || []).includes(day.value)}
                          onCheckedChange={() => toggleDeliveryDay(day.value)}
                        />
                        <Label htmlFor={day.value} className="text-sm cursor-pointer">
                          {day.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="delivery_lead_days">
                    Plazo de entrega (días desde pedido)
                  </Label>
                  <Input
                    id="delivery_lead_days"
                    type="number"
                    min="0"
                    value={formData.delivery_lead_days || 1}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        delivery_lead_days: parseInt(e.target.value) || 1,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Número de días mínimos entre el pedido y la entrega
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Notas adicionales..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingSupplier(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                !formData.name.trim() ||
                createSupplier.isPending ||
                updateSupplier.isPending
              }
            >
              {(createSupplier.isPending || updateSupplier.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingSupplier ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              El proveedor será desactivado y no aparecerá en la lista. Los productos asociados
              mantendrán la referencia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Suppliers;
