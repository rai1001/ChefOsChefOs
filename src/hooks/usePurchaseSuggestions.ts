import { useQuery } from "@tanstack/react-query";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import {
  ProcurementSuggestion,
  generateProcurementSuggestions,
} from "@/lib/procurementSuggestionEngine";

export interface SupplierSuggestionGroup {
  supplierId: string;
  supplierName: string;
  suggestions: ProcurementSuggestion[];
}

export function usePurchaseSuggestions() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["purchase_suggestions", hotelId],
    queryFn: async (): Promise<SupplierSuggestionGroup[]> => {
      if (!hotelId) return [];

      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 7);

      const [productsResult, eventsResult, forecastsResult] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            name,
            current_stock,
            min_stock,
            supplier_id,
            supplier:suppliers(id, name, delivery_lead_days)
          `)
          .eq("hotel_id", hotelId)
          .eq("is_active", true),
        supabase
          .from("events")
          .select("pax")
          .eq("hotel_id", hotelId)
          .gte("event_date", today.toISOString().slice(0, 10))
          .lte("event_date", end.toISOString().slice(0, 10)),
        supabase
          .from("forecasts")
          .select("breakfast_pax, half_board_pax, full_board_pax, extras_pax")
          .eq("hotel_id", hotelId)
          .gte("forecast_date", today.toISOString().slice(0, 10))
          .lte("forecast_date", end.toISOString().slice(0, 10)),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (forecastsResult.error) throw forecastsResult.error;

      const products = (productsResult.data ?? []) as Array<{
        id: string;
        name: string;
        current_stock: number | null;
        min_stock: number | null;
        supplier_id: string | null;
        supplier?: { id: string; name: string; delivery_lead_days: number | null } | null;
      }>;

      const eventsPax = (eventsResult.data ?? []).reduce((sum, event) => sum + (event.pax ?? 0), 0);
      const forecastPax = (forecastsResult.data ?? []).reduce(
        (sum, row) =>
          sum +
          (row.breakfast_pax ?? 0) +
          (row.half_board_pax ?? 0) +
          (row.full_board_pax ?? 0) +
          (row.extras_pax ?? 0),
        0,
      );

      const demandFactor = Math.max((eventsPax + forecastPax) / 300, 0.5);

      const suggestions = generateProcurementSuggestions(
        products.map((product) => {
          const minStock = product.min_stock ?? 0;
          const baseDemand = Math.max(minStock * demandFactor, 1);
          const leadDays = product.supplier?.delivery_lead_days ?? 1;
          return {
            productId: product.id,
            productName: product.name,
            forecastQty: baseDemand,
            eventQty: Math.max(eventsPax / 100, 0),
            menuQty: 0,
            currentQty: product.current_stock ?? 0,
            safetyStockQty: minStock,
            leadTimeDays: leadDays,
            dailyDemandRate: Math.max(baseDemand / 7, 0.25),
            packSize: 1,
            minOrderQty: 0,
            reservedQty: 0,
          };
        }),
      ).filter((suggestion) => suggestion.recommended_qty > 0);

      const grouped: Record<string, SupplierSuggestionGroup> = {};
      for (const product of products) {
        if (!product.supplier_id || !product.supplier?.name) continue;
        if (!grouped[product.supplier_id]) {
          grouped[product.supplier_id] = {
            supplierId: product.supplier_id,
            supplierName: product.supplier.name,
            suggestions: [],
          };
        }
      }

      for (const suggestion of suggestions) {
        const product = products.find((row) => row.id === suggestion.productId);
        if (!product?.supplier_id || !grouped[product.supplier_id]) continue;
        grouped[product.supplier_id].suggestions.push(suggestion);
      }

      return Object.values(grouped)
        .map((group) => ({
          ...group,
          suggestions: group.suggestions.sort((a, b) => b.recommended_qty - a.recommended_qty),
        }))
        .filter((group) => group.suggestions.length > 0);
    },
    enabled: !!hotelId,
  });
}
