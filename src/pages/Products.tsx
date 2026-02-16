import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProductsXLSXImport } from "@/components/import/ProductsXLSXImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Package,
  Edit2,
  Trash2,
  Loader2,
  History,
  AlertTriangle,
} from "lucide-react";
import {
  ProductWithRelations,
  useProducts,
  useProductCategories,
  useUnits,
  useSuppliers,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProductPriceHistory,
} from "@/hooks/useProducts";
import { getStockSeverity, resolveStockThresholds } from "@/lib/stockThresholds";

function severityBadgeTone(severity: "critical" | "medium" | "low" | "healthy"): string {
  if (severity === "critical") return "bg-destructive/10 text-destructive border-destructive/30";
  if (severity === "medium") return "bg-warning/10 text-warning border-warning/30";
  if (severity === "low") return "bg-info/10 text-info border-info/30";
  return "bg-success/10 text-success border-success/30";
}

function severityLabel(severity: "critical" | "medium" | "low" | "healthy"): string {
  if (severity === "critical") return "Critico";
  if (severity === "medium") return "Bajo minimo";
  if (severity === "low") return "Bajo optimo";
  return "OK";
}

const Products = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyProductId, setHistoryProductId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    unit_id: "",
    supplier_id: "",
    cost_price: "",
    critical_stock: "",
    min_stock: "",
    optimal_stock: "",
    notes: "",
  });

  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useProductCategories();
  const { data: units = [] } = useUnits();
  const { data: suppliers = [] } = useSuppliers();
  const { data: priceHistory = [], isLoading: historyLoading } = useProductPriceHistory(historyProductId);

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category?.id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const stockHealth = useMemo(() => {
    let critical = 0;
    let medium = 0;
    for (const product of products) {
      const thresholds = resolveStockThresholds({
        minStock: product.min_stock,
        optimalStock: product.optimal_stock,
        criticalStock: product.critical_stock,
        categoryMinStock: product.category?.default_min_stock,
        categoryOptimalStock: product.category?.default_optimal_stock,
        categoryCriticalStock: product.category?.default_critical_stock,
      });
      const severity = getStockSeverity(product.current_stock, thresholds);
      if (severity === "critical") critical += 1;
      if (severity === "medium") medium += 1;
    }
    return { critical, medium };
  }, [products]);

  const historySummary = useMemo(() => {
    if (!priceHistory.length) return { avg: 0, min: 0, max: 0 };
    const prices = priceHistory.map((row) => row.unit_price);
    const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
    return {
      avg,
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  }, [priceHistory]);

  const selectedHistoryProduct = products.find((product) => product.id === historyProductId);

  const resetForm = () => {
    setFormData({
      name: "",
      category_id: "",
      unit_id: "",
      supplier_id: "",
      cost_price: "",
      critical_stock: "",
      min_stock: "",
      optimal_stock: "",
      notes: "",
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (product: ProductWithRelations) => {
    setFormData({
      name: product.name,
      category_id: product.category_id || "",
      unit_id: product.unit_id || "",
      supplier_id: product.supplier_id || "",
      cost_price: product.cost_price?.toString() || "",
      critical_stock: product.critical_stock?.toString() || "",
      min_stock: product.min_stock?.toString() || "",
      optimal_stock: product.optimal_stock?.toString() || "",
      notes: product.notes || "",
    });
    setEditingProduct(product);
  };

  const handleSubmit = async () => {
    const data = {
      name: formData.name,
      category_id: formData.category_id || null,
      unit_id: formData.unit_id || null,
      supplier_id: formData.supplier_id || null,
      cost_price: formData.cost_price ? Number.parseFloat(formData.cost_price) : null,
      critical_stock: formData.critical_stock ? Number.parseFloat(formData.critical_stock) : null,
      min_stock: formData.min_stock ? Number.parseFloat(formData.min_stock) : null,
      optimal_stock: formData.optimal_stock ? Number.parseFloat(formData.optimal_stock) : null,
      notes: formData.notes || null,
    };

    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, ...data });
      setEditingProduct(null);
    } else {
      await createProduct.mutateAsync(data);
      setIsCreateOpen(false);
    }
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProduct.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <MainLayout title="Productos" subtitle="Maestro, umbrales y trazabilidad de precio">
      <div className="grid gap-4 sm:grid-cols-5 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total productos</p>
          <p className="font-display text-2xl font-semibold mt-1">{products.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Categorias</p>
          <p className="font-display text-2xl font-semibold mt-1">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Proveedores</p>
          <p className="font-display text-2xl font-semibold mt-1">{suppliers.length}</p>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Bajo minimo</p>
          <p className="font-display text-2xl font-semibold mt-1 text-warning">{stockHealth.medium}</p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Criticos</p>
          <p className="font-display text-2xl font-semibold mt-1 text-destructive">{stockHealth.critical}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar producto o proveedor..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <ProductsXLSXImport />
          <Button size="sm" className="h-9" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo producto
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Umbrales C/M/O</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {products.length === 0
                    ? "No hay productos. Importa desde Excel o crea uno nuevo."
                    : "No se encontraron productos"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const thresholds = resolveStockThresholds({
                  minStock: product.min_stock,
                  optimalStock: product.optimal_stock,
                  criticalStock: product.critical_stock,
                  categoryMinStock: product.category?.default_min_stock,
                  categoryOptimalStock: product.category?.default_optimal_stock,
                  categoryCriticalStock: product.category?.default_critical_stock,
                });
                const severity = getStockSeverity(product.current_stock, thresholds);

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-medium">{product.name}</span>
                          <div className="mt-1">
                            <Badge variant="outline" className={severityBadgeTone(severity)}>
                              {severityLabel(severity)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {product.category?.name || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      EUR {(product.cost_price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(product.current_stock || 0).toFixed(2)} {product.unit?.abbreviation || ""}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {thresholds.criticalStock.toFixed(2)} / {thresholds.minStock.toFixed(2)} / {thresholds.optimalStock.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.supplier?.name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setHistoryProductId(product.id)}
                          title="Historial de precios"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEdit(product)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteId(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isCreateOpen || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingProduct(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              Define umbrales por producto. Si quedan vacios, se aplicaran defaults de categoria.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select
                  value={formData.category_id || "none"}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin categoria</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Unidad</Label>
                <Select
                  value={formData.unit_id || "none"}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, unit_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin unidad</SelectItem>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name} ({unit.abbreviation})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (EUR)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(event) => setFormData((prev) => ({ ...prev, cost_price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label>Proveedor</Label>
                <Select
                  value={formData.supplier_id || "none"}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, supplier_id: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin proveedor</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="critical_stock">Critico</Label>
                <Input
                  id="critical_stock"
                  type="number"
                  min="0"
                  value={formData.critical_stock}
                  onChange={(event) => setFormData((prev) => ({ ...prev, critical_stock: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock">Minimo</Label>
                <Input
                  id="min_stock"
                  type="number"
                  min="0"
                  value={formData.min_stock}
                  onChange={(event) => setFormData((prev) => ({ ...prev, min_stock: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="optimal_stock">Optimo</Label>
                <Input
                  id="optimal_stock"
                  type="number"
                  min="0"
                  value={formData.optimal_stock}
                  onChange={(event) => setFormData((prev) => ({ ...prev, optimal_stock: event.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>

              <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 text-xs text-warning">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Regla: critico {"<="} minimo {"<="} optimo.
                </div>
              </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingProduct(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name || createProduct.isPending || updateProduct.isPending}>
              {(createProduct.isPending || updateProduct.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingProduct ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyProductId} onOpenChange={(open) => !open && setHistoryProductId(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Historial de precios</DialogTitle>
            <DialogDescription>
              {selectedHistoryProduct?.name || "Producto"} - comparativa por proveedor y fecha de pedido.
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-10 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : priceHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">Sin historial de compra para este producto.</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3 mb-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Precio medio</p>
                  <p className="font-medium">EUR {historySummary.avg.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Min</p>
                  <p className="font-medium">EUR {historySummary.min.toFixed(2)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-xs text-muted-foreground">Max</p>
                  <p className="font-medium">EUR {historySummary.max.toFixed(2)}</p>
                </div>
              </div>

              <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead className="text-right">Precio ud.</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceHistory.slice(0, 120).map((row) => (
                      <TableRow key={`${row.purchase_id}-${row.product_id}-${row.order_date}`}>
                        <TableCell>
                          {format(parseISO(row.order_date), "d MMM yyyy", { locale: es })}
                        </TableCell>
                        <TableCell>{row.supplier_name}</TableCell>
                        <TableCell className="text-right">EUR {row.unit_price.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{row.quantity.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.status || "draft"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar producto</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion no se puede deshacer. El producto se desactivara del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteProduct.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default Products;
