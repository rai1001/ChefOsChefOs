import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { toast } from "sonner";

export interface Menu {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  cost_per_pax: number | null;
  is_active: boolean | null;
  hotel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: string;
  menu_id: string;
  product_id: string;
  quantity_per_pax: number;
  preparation_notes: string | null;
  created_at: string;
  product?: {
    id: string;
    name: string;
    cost_price: number | null;
    unit?: { id: string; name: string; abbreviation: string } | null;
  };
}

export interface MenuWithItems extends Menu {
  menu_items: MenuItem[];
}

export interface MenuInsert {
  name: string;
  description?: string | null;
  type?: string | null;
  is_active?: boolean;
}

export interface MenuItemInsert {
  menu_id: string;
  product_id: string;
  quantity_per_pax: number;
  preparation_notes?: string | null;
}

// Fetch all menus for the current hotel
export function useMenusWithItems() {
  return useQuery({
    queryKey: ["menus-with-items"],
    queryFn: async () => {
      const { data: menus, error: menusError } = await supabase
        .from("menus")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (menusError) throw menusError;

      // Fetch menu items with product details for each menu
      const menusWithItems = await Promise.all(
        (menus || []).map(async (menu) => {
          const { data: items, error: itemsError } = await supabase
            .from("menu_items")
            .select(`
              *,
              product:products(id, name, cost_price, unit:units(id, name, abbreviation))
            `)
            .eq("menu_id", menu.id);

          if (itemsError) throw itemsError;

          // Calculate cost_per_pax from items
          const calculatedCost = (items || []).reduce((total, item) => {
            const productCost = item.product?.cost_price || 0;
            return total + (productCost * item.quantity_per_pax);
          }, 0);

          return {
            ...menu,
            menu_items: items || [],
            cost_per_pax: calculatedCost,
          } as MenuWithItems;
        })
      );

      return menusWithItems;
    },
  });
}

// Create a new menu with items
export function useCreateMenu() {
  const queryClient = useQueryClient();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async ({
      menu,
      items,
    }: {
      menu: MenuInsert;
      items: Omit<MenuItemInsert, "menu_id">[];
    }) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      // Create the menu
      const { data: newMenu, error: menuError } = await supabase
        .from("menus")
        .insert({
          ...menu,
          hotel_id: hotelId,
          is_active: true,
        })
        .select()
        .single();

      if (menuError) throw menuError;

      // Create menu items if any
      if (items.length > 0) {
        const menuItems = items.map((item) => ({
          ...item,
          menu_id: newMenu.id,
        }));

        const { error: itemsError } = await supabase
          .from("menu_items")
          .insert(menuItems);

        if (itemsError) throw itemsError;
      }

      // Calculate and update cost_per_pax
      await updateMenuCost(newMenu.id);

      return newMenu;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Receta creada correctamente");
    },
    onError: (error) => {
      toast.error("Error al crear receta: " + error.message);
    },
  });
}

// Update menu basic info
export function useUpdateMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Menu> & { id: string }) => {
      const { data, error } = await supabase
        .from("menus")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Receta actualizada");
    },
    onError: (error) => {
      toast.error("Error al actualizar: " + error.message);
    },
  });
}

// Delete menu (soft delete)
export function useDeleteMenu() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("menus")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Receta eliminada");
    },
    onError: (error) => {
      toast.error("Error al eliminar: " + error.message);
    },
  });
}

// Duplicate a menu with all its items
export function useDuplicateMenu() {
  const queryClient = useQueryClient();
  const hotelId = useCurrentHotelId();

  return useMutation({
    mutationFn: async (menuId: string) => {
      if (!hotelId) throw new Error("No hay hotel seleccionado");

      // Get original menu
      const { data: original, error: fetchError } = await supabase
        .from("menus")
        .select("*")
        .eq("id", menuId)
        .single();

      if (fetchError) throw fetchError;

      // Create duplicate menu
      const { data: newMenu, error: menuError } = await supabase
        .from("menus")
        .insert({
          name: `${original.name} (copia)`,
          description: original.description,
          type: original.type,
          hotel_id: hotelId,
          is_active: true,
        })
        .select()
        .single();

      if (menuError) throw menuError;

      // Get original items
      const { data: originalItems, error: itemsError } = await supabase
        .from("menu_items")
        .select("*")
        .eq("menu_id", menuId);

      if (itemsError) throw itemsError;

      // Duplicate items
      if (originalItems && originalItems.length > 0) {
        const newItems = originalItems.map((item) => ({
          menu_id: newMenu.id,
          product_id: item.product_id,
          quantity_per_pax: item.quantity_per_pax,
          preparation_notes: item.preparation_notes,
        }));

        const { error: insertError } = await supabase
          .from("menu_items")
          .insert(newItems);

        if (insertError) throw insertError;
      }

      // Update cost
      await updateMenuCost(newMenu.id);

      return newMenu;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Receta duplicada correctamente");
    },
    onError: (error) => {
      toast.error("Error al duplicar: " + error.message);
    },
  });
}

// Add item to menu
export function useAddMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: MenuItemInsert) => {
      const { data, error } = await supabase
        .from("menu_items")
        .insert(item)
        .select()
        .single();

      if (error) throw error;

      // Recalculate cost
      await updateMenuCost(item.menu_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Ingrediente añadido");
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });
}

// Update menu item
export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      menu_id,
      ...updates
    }: Partial<MenuItem> & { id: string; menu_id: string }) => {
      const { data, error } = await supabase
        .from("menu_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Recalculate cost
      await updateMenuCost(menu_id);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Ingrediente actualizado");
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });
}

// Remove item from menu
export function useRemoveMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, menu_id }: { id: string; menu_id: string }) => {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Recalculate cost
      await updateMenuCost(menu_id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus-with-items"] });
      toast.success("Ingrediente eliminado");
    },
    onError: (error) => {
      toast.error("Error: " + error.message);
    },
  });
}

// Helper function to recalculate and update menu cost
async function updateMenuCost(menuId: string) {
  // Get all items with product prices
  const { data: items, error: itemsError } = await supabase
    .from("menu_items")
    .select(`
      quantity_per_pax,
      product:products(cost_price)
    `)
    .eq("menu_id", menuId);

  if (itemsError) throw itemsError;

  // Calculate total cost per pax
  const totalCost = (items || []).reduce((sum, item) => {
    const productCost = item.product?.cost_price || 0;
    return sum + (productCost * item.quantity_per_pax);
  }, 0);

  // Update menu with calculated cost
  const { error: updateError } = await supabase
    .from("menus")
    .update({ cost_per_pax: totalCost })
    .eq("id", menuId);

  if (updateError) throw updateError;

  return totalCost;
}
