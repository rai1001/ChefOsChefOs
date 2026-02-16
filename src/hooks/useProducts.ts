import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
  supplier_id: string | null;
  cost_price: number | null;
  current_stock: number | null;
  min_stock: number | null;
  optimal_stock: number;
  critical_stock: number;
  allergens: string[] | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithRelations extends Product {
  category?: {
    id: string;
    name: string;
    default_min_stock: number;
    default_optimal_stock: number;
    default_critical_stock: number;
  } | null;
  unit?: { id: string; name: string; abbreviation: string } | null;
  supplier?: { id: string; name: string } | null;
}

export interface ProductInsert {
  name: string;
  category_id?: string | null;
  unit_id?: string | null;
  supplier_id?: string | null;
  cost_price?: number | null;
  current_stock?: number | null;
  min_stock?: number | null;
  optimal_stock?: number;
  critical_stock?: number;
  allergens?: string[] | null;
  notes?: string | null;
}

export interface ProductPriceHistoryRow {
  purchase_id: string;
  product_id: string;
  product_name: string;
  supplier_id: string | null;
  supplier_name: string;
  order_date: string;
  status: string | null;
  unit_price: number;
  quantity: number;
}

export function useProducts() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["products", hotelId],
    queryFn: async () => {
      if (!hotelId) return [] as ProductWithRelations[];
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:product_categories(id, name, default_min_stock, default_optimal_stock, default_critical_stock),
          unit:units(id, name, abbreviation),
          supplier:suppliers(id, name)
        `)
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as ProductWithRelations[];
    },
    enabled: !!hotelId,
  });
}

export function useProductCategories() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["product_categories", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });
}

export function useProductPriceHistory(productId?: string | null) {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["product_price_history", hotelId, productId ?? "all"],
    enabled: !!hotelId,
    queryFn: async (): Promise<ProductPriceHistoryRow[]> => {
      if (!hotelId) return [];

      const { data, error } = await supabase
        .from("purchases")
        .select(`
          id,
          order_date,
          status,
          supplier:suppliers(id, name),
          items:purchase_items(
            product_id,
            quantity,
            unit_price,
            product:products(id, name)
          )
        `)
        .eq("hotel_id", hotelId)
        .in("status", ["ordered", "received"])
        .order("order_date", { ascending: false })
        .limit(300);

      if (error) throw error;

      const rows: ProductPriceHistoryRow[] = [];
      for (const purchase of data ?? []) {
        for (const item of purchase.items ?? []) {
          if (item.unit_price == null || item.product_id == null) continue;
          if (productId && item.product_id !== productId) continue;
          rows.push({
            purchase_id: purchase.id,
            product_id: item.product_id,
            product_name: item.product?.name ?? "Producto",
            supplier_id: purchase.supplier?.id ?? null,
            supplier_name: purchase.supplier?.name ?? "Sin proveedor",
            order_date: purchase.order_date,
            status: purchase.status,
            unit_price: item.unit_price,
            quantity: item.quantity ?? 0,
          });
        }
      }

      return rows.sort((a, b) => b.order_date.localeCompare(a.order_date));
    },
  });
}

export function useUnits() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["units", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .eq("hotel_id", hotelId)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });
}

export function useSuppliers() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["suppliers", hotelId],
    queryFn: async () => {
      if (!hotelId) return [];
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
    enabled: !!hotelId,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (product: ProductInsert) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");
      
      const { data, error } = await supabase
        .from("products")
        .insert({ ...product, hotel_id: hotelId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Producto creado",
        description: "El producto se ha añadido correctamente",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Producto actualizado",
        description: "Los cambios se han guardado",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Producto eliminado",
        description: "El producto se ha eliminado",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });
}

export function useBulkInsertProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (products: ProductInsert[]) => {
      const { data, error } = await supabase
        .from("products")
        .insert(products)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: "Productos importados",
        description: `Se importaron ${data.length} productos correctamente`,
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error al importar",
        description: error.message,
      });
    },
  });
}
