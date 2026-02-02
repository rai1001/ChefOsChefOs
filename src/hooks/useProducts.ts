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
  allergens: string[] | null;
  notes: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithRelations extends Product {
  category?: { id: string; name: string } | null;
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
  allergens?: string[] | null;
  notes?: string | null;
}

export function useProducts() {
  return useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:product_categories(id, name),
          unit:units(id, name, abbreviation),
          supplier:suppliers(id, name)
        `)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data as ProductWithRelations[];
    },
  });
}

export function useProductCategories() {
  return useQuery({
    queryKey: ["product_categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
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
