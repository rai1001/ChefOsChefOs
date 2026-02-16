import { useQuery } from "@tanstack/react-query";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import {
  ProcurementSuggestion,
  calculateSuggestedQty,
  generateProcurementSuggestions,
} from "@/lib/procurementSuggestionEngine";
import {
  getStockSeverity,
  resolveStockThresholds,
  type StockSeverity,
} from "@/lib/stockThresholds";

export interface ProductPurchaseSuggestion extends ProcurementSuggestion {
  severity: Exclude<StockSeverity, "healthy">;
  supplierId: string;
  supplierName: string;
  currentStock: number;
  minStock: number;
  optimalStock: number;
  criticalStock: number;
  estimatedCost: number | null;
}

export interface SupplierSuggestionGroup {
  supplierId: string;
  supplierName: string;
  criticalCount: number;
  suggestions: ProductPurchaseSuggestion[];
}

function severityRank(severity: Exclude<StockSeverity, "healthy">): number {
  if (severity === "critical") return 0;
  if (severity === "medium") return 1;
  return 2;
}

function toPaxForPlanning(event: {
  status: string | null;
  pax: number | null;
  pax_estimated: number | null;
  pax_confirmed: number | null;
}): number {
  const confirmed = Math.max(event.pax_confirmed ?? 0, 0);
  const estimated = Math.max(event.pax_estimated ?? 0, event.pax ?? 0, 0);
  if ((event.status ?? "draft") === "draft") return Math.max(estimated * 0.65, confirmed);
  return Math.max(confirmed, estimated);
}

export function usePurchaseSuggestions() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["purchase_suggestions", hotelId],
    queryFn: async (): Promise<SupplierSuggestionGroup[]> => {
      if (!hotelId) return [];

      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      const startIso = today.toISOString().slice(0, 10);
      const endIso = end.toISOString().slice(0, 10);

      const [productsResult, eventsResult, forecastsResult] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            name,
            current_stock,
            min_stock,
            optimal_stock,
            critical_stock,
            cost_price,
            supplier_id,
            supplier:suppliers(id, name, delivery_lead_days),
            category:product_categories(default_min_stock, default_optimal_stock, default_critical_stock)
          `)
          .eq("hotel_id", hotelId)
          .eq("is_active", true),
        supabase
          .from("events")
          .select("id, menu_id, status, pax, pax_estimated, pax_confirmed")
          .eq("hotel_id", hotelId)
          .neq("status", "cancelled")
          .gte("event_date", startIso)
          .lte("event_date", endIso),
        supabase
          .from("forecasts")
          .select("breakfast_pax, half_board_pax, full_board_pax, extras_pax")
          .eq("hotel_id", hotelId)
          .gte("forecast_date", startIso)
          .lte("forecast_date", endIso),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (eventsResult.error) throw eventsResult.error;
      if (forecastsResult.error) throw forecastsResult.error;

      const menuIds = Array.from(
        new Set((eventsResult.data ?? []).map((event) => event.menu_id).filter(Boolean)),
      ) as string[];

      const menuItemsResult = menuIds.length
        ? await supabase
            .from("menu_items")
            .select("menu_id, product_id, quantity_per_pax")
            .in("menu_id", menuIds)
        : { data: [], error: null };

      if (menuItemsResult.error) throw menuItemsResult.error;

      const menuItemsByMenu = new Map<string, Array<{ product_id: string; quantity_per_pax: number }>>();
      for (const item of menuItemsResult.data ?? []) {
        const list = menuItemsByMenu.get(item.menu_id) ?? [];
        list.push({
          product_id: item.product_id,
          quantity_per_pax: item.quantity_per_pax ?? 0,
        });
        menuItemsByMenu.set(item.menu_id, list);
      }

      const demandByProduct = new Map<string, number>();
      let eventsPax = 0;
      for (const event of eventsResult.data ?? []) {
        const pax = toPaxForPlanning(event);
        eventsPax += pax;
        if (!event.menu_id) continue;
        const menuItems = menuItemsByMenu.get(event.menu_id) ?? [];
        for (const item of menuItems) {
          const prev = demandByProduct.get(item.product_id) ?? 0;
          demandByProduct.set(item.product_id, prev + item.quantity_per_pax * pax);
        }
      }

      const forecastPax = (forecastsResult.data ?? []).reduce(
        (sum, row) =>
          sum +
          (row.breakfast_pax ?? 0) +
          (row.half_board_pax ?? 0) +
          (row.full_board_pax ?? 0) +
          (row.extras_pax ?? 0),
        0,
      );

      const globalDemandFactor = Math.max((forecastPax + eventsPax) / 500, 0.8);

      const products = (productsResult.data ?? []) as Array<{
        id: string;
        name: string;
        current_stock: number | null;
        min_stock: number | null;
        optimal_stock: number | null;
        critical_stock: number | null;
        cost_price: number | null;
        supplier_id: string | null;
        supplier?: { id: string; name: string; delivery_lead_days: number | null } | null;
        category?: {
          default_min_stock: number | null;
          default_optimal_stock: number | null;
          default_critical_stock: number | null;
        } | null;
      }>;

      const signals = products.map((product) => {
        const thresholds = resolveStockThresholds({
          minStock: product.min_stock,
          optimalStock: product.optimal_stock,
          criticalStock: product.critical_stock,
          categoryMinStock: product.category?.default_min_stock,
          categoryOptimalStock: product.category?.default_optimal_stock,
          categoryCriticalStock: product.category?.default_critical_stock,
        });

        const menuDemand = demandByProduct.get(product.id) ?? 0;
        const baselineForecastDemand = Math.max(thresholds.minStock * globalDemandFactor * 0.3, 0.5);

        return {
          product,
          thresholds,
          signal: {
            productId: product.id,
            productName: product.name,
            forecastQty: baselineForecastDemand,
            eventQty: menuDemand,
            menuQty: 0,
            currentQty: product.current_stock ?? 0,
            safetyStockQty: thresholds.minStock,
            leadTimeDays: product.supplier?.delivery_lead_days ?? 1,
            dailyDemandRate: Math.max((baselineForecastDemand + menuDemand) / 14, 0.1),
            packSize: 1,
            minOrderQty: 0,
            reservedQty: 0,
          },
        };
      });

      const baseSuggestions = generateProcurementSuggestions(signals.map((row) => row.signal)).filter(
        (suggestion) => suggestion.recommended_qty > 0,
      );

      const byProductId = new Map(
        signals.map((row) => [
          row.product.id,
          {
            product: row.product,
            thresholds: row.thresholds,
            suggestedQty: calculateSuggestedQty(row.signal),
          },
        ]),
      );

      const grouped: Record<string, SupplierSuggestionGroup> = {};
      for (const suggestion of baseSuggestions) {
        const payload = byProductId.get(suggestion.productId);
        if (!payload || !payload.product.supplier_id || !payload.product.supplier?.name) continue;

        const severity = getStockSeverity(payload.product.current_stock, payload.thresholds);
        const normalizedSeverity: Exclude<StockSeverity, "healthy"> =
          severity === "healthy" ? "low" : severity;

        const supplierId = payload.product.supplier_id;
        if (!grouped[supplierId]) {
          grouped[supplierId] = {
            supplierId,
            supplierName: payload.product.supplier.name,
            criticalCount: 0,
            suggestions: [],
          };
        }

        if (normalizedSeverity === "critical") grouped[supplierId].criticalCount += 1;

        grouped[supplierId].suggestions.push({
          ...suggestion,
          recommended_qty: payload.suggestedQty,
          severity: normalizedSeverity,
          supplierId,
          supplierName: payload.product.supplier.name,
          currentStock: payload.product.current_stock ?? 0,
          minStock: payload.thresholds.minStock,
          optimalStock: payload.thresholds.optimalStock,
          criticalStock: payload.thresholds.criticalStock,
          estimatedCost:
            payload.product.cost_price != null
              ? Number((payload.product.cost_price * payload.suggestedQty).toFixed(2))
              : null,
        });
      }

      return Object.values(grouped)
        .map((group) => ({
          ...group,
          suggestions: group.suggestions.sort((a, b) => {
            if (a.severity !== b.severity) return severityRank(a.severity) - severityRank(b.severity);
            return b.recommended_qty - a.recommended_qty;
          }),
        }))
        .sort((a, b) => {
          if (a.criticalCount !== b.criticalCount) return b.criticalCount - a.criticalCount;
          return a.supplierName.localeCompare(b.supplierName);
        });
    },
    enabled: !!hotelId,
  });
}
