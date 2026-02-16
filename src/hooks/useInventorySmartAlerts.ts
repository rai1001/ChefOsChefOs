import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateSuggestedReplenishment,
  getStockSeverity,
  resolveStockThresholds,
  type StockSeverity,
} from "@/lib/stockThresholds";

export interface InventoryStockAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  minStock: number;
  optimalStock: number;
  criticalStock: number;
  severity: Exclude<StockSeverity, "healthy">;
  recommendedQty: number;
  supplierId: string | null;
  supplierName: string;
  ctaLabel: string;
  ctaTo: string;
}

export interface InventoryExpiryAlert {
  id: string;
  lotId: string;
  productId: string;
  productName: string;
  quantity: number;
  expiryDate: string;
  daysRemaining: number;
  severity: "critical" | "medium" | "low";
  ctaLabel: string;
  ctaTo: string;
}

export interface InventoryExpiryWindowCounts {
  critical3d: number;
  warning7d: number;
  watch14d: number;
}

export interface InventorySmartAlertsData {
  stockAlerts: InventoryStockAlert[];
  expiryAlerts: InventoryExpiryAlert[];
  expiryWindows: InventoryExpiryWindowCounts;
}

function severityOrder(severity: "critical" | "medium" | "low"): number {
  if (severity === "critical") return 0;
  if (severity === "medium") return 1;
  return 2;
}

function buildQuickPurchaseCta(supplierId: string | null, productId: string, qty: number) {
  if (!supplierId || qty <= 0) {
    return {
      ctaLabel: "Configurar producto",
      ctaTo: "/products",
    };
  }
  const params = new URLSearchParams({
    quick: "suggested",
    supplier_id: supplierId,
    product_id: productId,
    qty: String(Math.max(Math.ceil(qty), 1)),
  });
  return {
    ctaLabel: "Compra rapida",
    ctaTo: `/purchases?${params.toString()}`,
  };
}

export function useInventorySmartAlerts() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["inventory-smart-alerts", hotelId],
    enabled: !!hotelId,
    queryFn: async (): Promise<InventorySmartAlertsData> => {
      if (!hotelId) {
        return {
          stockAlerts: [],
          expiryAlerts: [],
          expiryWindows: { critical3d: 0, warning7d: 0, watch14d: 0 },
        };
      }

      const today = new Date();
      const date14 = new Date(today);
      date14.setDate(date14.getDate() + 14);
      const date14Iso = date14.toISOString().slice(0, 10);

      const [productsResult, lotsResult] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            name,
            supplier_id,
            current_stock,
            min_stock,
            optimal_stock,
            critical_stock,
            supplier:suppliers(id, name),
            category:product_categories(default_min_stock, default_optimal_stock, default_critical_stock)
          `)
          .eq("hotel_id", hotelId)
          .eq("is_active", true),
        supabase
          .from("inventory_lots")
          .select(`
            id,
            product_id,
            quantity,
            expiry_date,
            product:products(id, name)
          `)
          .eq("hotel_id", hotelId)
          .gt("quantity", 0)
          .not("expiry_date", "is", null)
          .lte("expiry_date", date14Iso)
          .order("expiry_date", { ascending: true }),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (lotsResult.error) throw lotsResult.error;

      const stockAlerts: InventoryStockAlert[] = [];
      for (const product of productsResult.data ?? []) {
        const thresholds = resolveStockThresholds({
          minStock: product.min_stock,
          optimalStock: product.optimal_stock,
          criticalStock: product.critical_stock,
          categoryMinStock: product.category?.default_min_stock,
          categoryOptimalStock: product.category?.default_optimal_stock,
          categoryCriticalStock: product.category?.default_critical_stock,
        });
        const severity = getStockSeverity(product.current_stock, thresholds);
        if (severity === "healthy") continue;

        const recommendedQty = calculateSuggestedReplenishment(product.current_stock, thresholds);
        const quickCta = buildQuickPurchaseCta(product.supplier_id, product.id, recommendedQty);

        stockAlerts.push({
          id: `stock-${product.id}`,
          productId: product.id,
          productName: product.name,
          currentStock: product.current_stock ?? 0,
          minStock: thresholds.minStock,
          optimalStock: thresholds.optimalStock,
          criticalStock: thresholds.criticalStock,
          severity,
          recommendedQty,
          supplierId: product.supplier_id,
          supplierName: product.supplier?.name ?? "Sin proveedor",
          ctaLabel: quickCta.ctaLabel,
          ctaTo: quickCta.ctaTo,
        });
      }

      stockAlerts.sort((a, b) => {
        if (a.severity !== b.severity) return severityOrder(a.severity) - severityOrder(b.severity);
        return a.productName.localeCompare(b.productName);
      });

      const expiryAlerts: InventoryExpiryAlert[] = [];
      let critical3d = 0;
      let warning7d = 0;
      let watch14d = 0;

      for (const lot of lotsResult.data ?? []) {
        if (!lot.expiry_date) continue;
        const daysRemaining = differenceInCalendarDays(parseISO(lot.expiry_date), today);
        const severity = daysRemaining <= 3 ? "critical" : daysRemaining <= 7 ? "medium" : "low";

        if (daysRemaining <= 3) critical3d += 1;
        if (daysRemaining <= 7) warning7d += 1;
        if (daysRemaining <= 14) watch14d += 1;

        expiryAlerts.push({
          id: `expiry-${lot.id}`,
          lotId: lot.id,
          productId: lot.product_id,
          productName: lot.product?.name ?? "Producto",
          quantity: lot.quantity ?? 0,
          expiryDate: lot.expiry_date,
          daysRemaining,
          severity,
          ctaLabel: severity === "critical" ? "Registrar merma" : "Revisar lote",
          ctaTo: severity === "critical" ? "/inventory?quick=waste" : "/inventory",
        });
      }

      expiryAlerts.sort((a, b) => {
        if (a.severity !== b.severity) return severityOrder(a.severity) - severityOrder(b.severity);
        return a.expiryDate.localeCompare(b.expiryDate);
      });

      return {
        stockAlerts,
        expiryAlerts,
        expiryWindows: {
          critical3d,
          warning7d,
          watch14d,
        },
      };
    },
  });
}
