import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProductsXLSXImport } from "@/components/import/ProductsXLSXImport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
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
import { Plus, Search, Package, Edit2, Trash2, Loader2 } from "lucide-react";
import { 
  useProducts, 
  useProductCategories, 
  useUnits, 
  useSuppliers,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  ProductWithRelations 
} from "@/hooks/useProducts";

const Products = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithRelations | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    unit_id: "",
    supplier_id: "",
    cost_price: "",
    min_stock: "",
    notes: "",
  });

  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useProductCategories();
  const { data: units = [] } = useUnits();
  const { data: suppliers = [] } = useSuppliers();
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.supplier?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || product.category?.id === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const resetForm = () => {
    setFormData({
      name: "",
      category_id: "",
      unit_id: "",
      supplier_id: "",
      cost_price: "",
      min_stock: "",
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
      min_stock: product.min_stock?.toString() || "",
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
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      min_stock: formData.min_stock ? parseFloat(formData.min_stock) : null,
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

  const uniqueCategories = categories;

  return (
    <MainLayout 
      title="Productos" 
      subtitle="Maestro de artículos y precios"
    >
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Total productos</p>
          <p className="font-display text-2xl font-semibold mt-1">{products.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Categorías</p>
          <p className="font-display text-2xl font-semibold mt-1">{categories.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Proveedores</p>
          <p className="font-display text-2xl font-semibold mt-1">{suppliers.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">Precio medio</p>
          <p className="font-display text-2xl font-semibold mt-1">
            €{products.length > 0 
              ? (products.reduce((sum, p) => sum + (p.cost_price || 0), 0) / products.length).toFixed(2)
              : "0.00"
            }
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar productos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {uniqueCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <ProductsXLSXImport />
          <Button size="sm" className="h-9" onClick={handleOpenCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Unidad</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead>Proveedor</TableHead>
              <TableHead>Stock mín.</TableHead>
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
                  {products.length === 0 ? "No hay productos. Importa desde Excel o crea uno nuevo." : "No se encontraron productos"}
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <span className="font-medium">{product.name}</span>
                        {product.allergens && product.allergens.length > 0 && (
                          <p className="text-xs text-warning">{product.allergens.length} alérgenos</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {product.category?.name || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.unit?.abbreviation || "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    €{(product.cost_price || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.supplier?.name || "—"}
                  </TableCell>
                  <TableCell>
                    {product.min_stock ? (
                      <span className="text-sm">{product.min_stock} {product.unit?.abbreviation}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
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
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || !!editingProduct} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setEditingProduct(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Producto" : "Nuevo Producto"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "Modifica los datos del producto" : "Añade un nuevo producto al catálogo"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Select 
                  value={formData.category_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unidad</Label>
                <Select 
                  value={formData.unit_id} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, unit_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name} ({unit.abbreviation})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (€)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, cost_price: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="min_stock">Stock mínimo</Label>
                <Input
                  id="min_stock"
                  type="number"
                  value={formData.min_stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, min_stock: e.target.value }))}
                  placeholder="0"
                />
              </div>
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
                  {suppliers.map((sup) => (
                    <SelectItem key={sup.id} value={sup.id}>{sup.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setEditingProduct(null);
              resetForm();
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || createProduct.isPending || updateProduct.isPending}
            >
              {(createProduct.isPending || updateProduct.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingProduct ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El producto será desactivado del sistema.
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
