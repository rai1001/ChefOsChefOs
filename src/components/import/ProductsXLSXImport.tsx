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
import { useBulkInsertProducts, useProductCategories, useUnits } from "@/hooks/useProducts";

interface ParsedProduct {
  name: string;
  unit: string;
  price: number;
  allergens: string[];
}

export function ProductsXLSXImport() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<ParsedProduct[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const bulkInsert = useBulkInsertProducts();
  const { data: categories } = useProductCategories();
  const { data: units } = useUnits();

  const allergenColumns = [
    'HUEVO', 'LECHE', 'GLÚTEN', 'FRUTOS CÁSCARA', 'CACAHUETE', 'SÉSAMO',
    'ALTRAMÚZ', 'PESCADO', 'CRUSTÁCEOS', 'MOLUSCOS', 'SOJA', 'APIO',
    'MOSTAZA', 'DIÓXIDO AZUFRE Y SULFITOS'
  ];

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
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];

      // Find header row
      const headerRowIndex = jsonData.findIndex(row => 
        row.some(cell => typeof cell === 'string' && cell.includes('HUEVO'))
      );

      if (headerRowIndex === -1) {
        throw new Error('No se encontró la estructura esperada de ingredientes');
      }

      const headers = jsonData[headerRowIndex] as string[];
      const products: ParsedProduct[] = [];

      // Process data rows
      for (let i = headerRowIndex + 2; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || !row[0]) continue;

        const name = String(row[0]).trim();
        if (!name || name === 'SELECCIONAR PRODUCTO BASE') continue;

        const unit = String(row[1] || 'UD');
        const priceStr = String(row[2] || '0').replace('€', '').replace(',', '.').trim();
        const price = parseFloat(priceStr) || 0;

        // Extract allergens
        const allergens: string[] = [];
        for (let j = 3; j < headers.length && j < row.length; j++) {
          const value = String(row[j] || '').toUpperCase();
          if (value === 'SI' || value === 'SÍ' || value === 'TRAZAS') {
            const allergenIndex = j - 3;
            if (allergenColumns[allergenIndex]) {
              allergens.push(allergenColumns[allergenIndex]);
            }
          }
        }

        products.push({ name, unit, price, allergens });
      }

      setParsedProducts(products);
      toast({
        title: "Archivo procesado",
        description: `Se encontraron ${products.length} productos`,
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

  const findUnitId = (unitStr: string): string | null => {
    if (!units) return null;
    const normalized = unitStr.toLowerCase().trim();
    const unit = units.find(u => 
      u.abbreviation.toLowerCase() === normalized ||
      u.name.toLowerCase() === normalized
    );
    return unit?.id || null;
  };

  const handleConfirmImport = async () => {
    const productsToInsert = parsedProducts.map(p => ({
      name: p.name,
      cost_price: p.price,
      unit_id: findUnitId(p.unit),
      allergens: p.allergens.length > 0 ? p.allergens : null,
    }));

    await bulkInsert.mutateAsync(productsToInsert);
    setOpen(false);
    setParsedProducts([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Importar desde Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-display">Importar Productos desde Excel</DialogTitle>
          <DialogDescription>
            Sube un Excel de productos para revisar la vista previa antes de importar.
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
              El archivo debe contener columnas: Producto, Unidad, Precio, y alérgenos (HUEVO, LECHE, GLÚTEN, etc.)
            </p>
          </div>

          {parsedProducts.length > 0 && (
            <>
              <div className="text-sm text-muted-foreground">
                Vista previa: {parsedProducts.length} productos encontrados
              </div>
              <ScrollArea className="h-64 rounded border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Producto</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Alérgenos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedProducts.slice(0, 50).map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium text-sm">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-sm">{product.unit}</TableCell>
                        <TableCell className="text-sm">
                          {product.price.toFixed(2)} €
                        </TableCell>
                        <TableCell className="text-xs">
                          {product.allergens.length > 0 ? (
                            <span className="text-warning">
                              {product.allergens.join(', ')}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedProducts.length > 50 && (
                  <p className="text-center text-xs text-muted-foreground py-2">
                    ... y {parsedProducts.length - 50} más
                  </p>
                )}
              </ScrollArea>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setParsedProducts([])}>
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
                  Importar {parsedProducts.length} productos
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
