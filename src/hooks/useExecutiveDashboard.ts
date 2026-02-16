import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, format, subDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentHotelId } from "@/hooks/useCurrentHotel";

export type AlertSeverity = "critical" | "medium" | "low";

export interface PrioritizedAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  ctaLabel: string;
  ctaTo: string;
}

export interface ExecutiveDashboardMetrics {
  estimatedDailyCost: number;
  estimatedWasteEuro30d: number;
  estimatedWastePct30d: number;
  stockoutsToday: number;
  projectedStockouts7d: number;
  forecastDeviationPct7d: number | null;
  forecastDeviationAbs7d: number | null;
  forecastReference: string;
  alerts: PrioritizedAlert[];
}

const supabaseUntyped = supabase as unknown as SupabaseClient;

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function sortAlerts(alerts: PrioritizedAlert[]) {
  const order: Record<AlertSeverity, number> = {
    critical: 0,
    medium: 1,
    low: 2,
  };
  return [...alerts].sort((a, b) => order[a.severity] - order[b.severity]);
}

export function useExecutiveDashboardMetrics() {
  const hotelId = useCurrentHotelId();

  return useQuery({
    queryKey: ["executive-dashboard-metrics", hotelId],
    enabled: !!hotelId,
    queryFn: async (): Promise<ExecutiveDashboardMetrics> => {
      if (!hotelId) {
        return {
          estimatedDailyCost: 0,
          estimatedWasteEuro30d: 0,
          estimatedWastePct30d: 0,
          stockoutsToday: 0,
          projectedStockouts7d: 0,
          forecastDeviationPct7d: null,
          forecastDeviationAbs7d: null,
          forecastReference: "Sin datos",
          alerts: [],
        };
      }

      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const next7d = format(addDays(today, 7), "yyyy-MM-dd");
      const plus2d = format(addDays(today, 2), "yyyy-MM-dd");
      const last30d = format(subDays(today, 30), "yyyy-MM-dd");
      const last7d = format(subDays(today, 7), "yyyy-MM-dd");
      const yesterday = format(subDays(today, 1), "yyyy-MM-dd");

      const [
        todayForecastResult,
        todayEventsResult,
        breakfastMenusResult,
        wasteResult,
        purchases30dResult,
        productsResult,
        upcomingEventsResult,
        pendingHighTasksResult,
        overdueDeliveriesResult,
        criticalExpiryResult,
        forecastsPast7dResult,
        eventsPast7dResult,
      ] = await Promise.all([
        supabaseUntyped
          .from("forecasts")
          .select("breakfast_pax")
          .eq("hotel_id", hotelId)
          .eq("forecast_date", todayStr),
        supabaseUntyped
          .from("events")
          .select("id, pax, menu:menus(cost_per_pax)")
          .eq("hotel_id", hotelId)
          .neq("status", "cancelled")
          .eq("event_date", todayStr),
        supabaseUntyped
          .from("menus")
          .select("id, type, cost_per_pax")
          .eq("hotel_id", hotelId)
          .eq("is_active", true),
        supabaseUntyped
          .from("inventory_waste")
          .select("qty, product:products(cost_price)")
          .eq("hotel_id", hotelId)
          .gte("recorded_at", `${last30d}T00:00:00.000Z`),
        supabaseUntyped
          .from("purchases")
          .select("total_amount")
          .eq("hotel_id", hotelId)
          .eq("status", "received")
          .gte("order_date", last30d),
        supabaseUntyped
          .from("products")
          .select("id, name, current_stock, min_stock")
          .eq("hotel_id", hotelId)
          .eq("is_active", true),
        supabaseUntyped
          .from("events")
          .select("id, menu_id, pax, status")
          .eq("hotel_id", hotelId)
          .neq("status", "cancelled")
          .gte("event_date", todayStr)
          .lte("event_date", next7d),
        supabaseUntyped
          .from("production_tasks")
          .select("id")
          .eq("hotel_id", hotelId)
          .in("status", ["pending", "in_progress"])
          .eq("priority", "high")
          .lte("task_date", next7d),
        supabaseUntyped
          .from("purchases")
          .select("id")
          .eq("hotel_id", hotelId)
          .eq("status", "ordered")
          .lt("expected_date", todayStr),
        supabaseUntyped
          .from("inventory_lots")
          .select("id")
          .eq("hotel_id", hotelId)
          .gt("quantity", 0)
          .gte("expiry_date", todayStr)
          .lte("expiry_date", plus2d),
        supabaseUntyped
          .from("forecasts")
          .select("forecast_date, breakfast_pax")
          .eq("hotel_id", hotelId)
          .gte("forecast_date", last7d)
          .lte("forecast_date", yesterday),
        supabaseUntyped
          .from("events")
          .select("event_date, pax, status")
          .eq("hotel_id", hotelId)
          .gte("event_date", last7d)
          .lte("event_date", yesterday)
          .in("status", ["confirmed", "in_progress", "completed"]),
      ]);

      const queryErrors = [
        todayForecastResult.error,
        todayEventsResult.error,
        breakfastMenusResult.error,
        wasteResult.error,
        purchases30dResult.error,
        productsResult.error,
        upcomingEventsResult.error,
        pendingHighTasksResult.error,
        overdueDeliveriesResult.error,
        criticalExpiryResult.error,
        forecastsPast7dResult.error,
        eventsPast7dResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        throw queryErrors[0];
      }

      const menuIds = Array.from(
        new Set(
          (upcomingEventsResult.data ?? [])
            .map((event: { menu_id?: string | null }) => event.menu_id)
            .filter(Boolean),
        ),
      ) as string[];

      const menuItemsResult = menuIds.length
        ? await supabaseUntyped
            .from("menu_items")
            .select("menu_id, product_id, quantity_per_pax")
            .in("menu_id", menuIds)
        : { data: [], error: null };

      if (menuItemsResult.error) {
        throw menuItemsResult.error;
      }

      const breakfastPaxToday = (todayForecastResult.data ?? []).reduce(
        (sum: number, row: { breakfast_pax?: number | null }) => sum + toNumber(row.breakfast_pax),
        0,
      );

      const breakfastMenus = (breakfastMenusResult.data ?? []).filter(
        (menu: { type?: string | null }) => menu.type === "breakfast",
      );

      const breakfastCostPerPax = breakfastMenus.length
        ? breakfastMenus.reduce(
            (sum: number, menu: { cost_per_pax?: number | null }) => sum + toNumber(menu.cost_per_pax),
            0,
          ) / breakfastMenus.length
        : 0;

      const todayEventsCost = (todayEventsResult.data ?? []).reduce(
        (
          sum: number,
          event: { pax?: number | null; menu?: { cost_per_pax?: number | null } | null },
        ) => sum + toNumber(event.pax) * toNumber(event.menu?.cost_per_pax),
        0,
      );

      const estimatedDailyCost = todayEventsCost + breakfastPaxToday * breakfastCostPerPax;

      const estimatedWasteEuro30d = (wasteResult.data ?? []).reduce(
        (
          sum: number,
          row: { qty?: number | null; product?: { cost_price?: number | null } | null },
        ) => sum + toNumber(row.qty) * toNumber(row.product?.cost_price),
        0,
      );

      const receivedSpend30d = (purchases30dResult.data ?? []).reduce(
        (sum: number, purchase: { total_amount?: number | null }) => sum + toNumber(purchase.total_amount),
        0,
      );

      const estimatedWastePct30d =
        receivedSpend30d > 0 ? (estimatedWasteEuro30d / receivedSpend30d) * 100 : 0;

      const products = (productsResult.data ?? []) as Array<{
        id: string;
        name: string;
        current_stock: number | null;
        min_stock: number | null;
      }>;

      const stockoutsToday = products.filter((product) => toNumber(product.current_stock) <= 0).length;

      const demandByProduct = new Map<string, number>();
      const menuItemsByMenu = new Map<
        string,
        Array<{ product_id: string; quantity_per_pax: number | null }>
      >();

      for (const item of (menuItemsResult.data ?? []) as Array<{
        menu_id: string;
        product_id: string;
        quantity_per_pax: number | null;
      }>) {
        const prev = menuItemsByMenu.get(item.menu_id) ?? [];
        prev.push(item);
        menuItemsByMenu.set(item.menu_id, prev);
      }

      for (const event of (upcomingEventsResult.data ?? []) as Array<{
        menu_id: string | null;
        pax: number | null;
      }>) {
        if (!event.menu_id) continue;
        const items = menuItemsByMenu.get(event.menu_id) ?? [];
        for (const item of items) {
          const previous = demandByProduct.get(item.product_id) ?? 0;
          demandByProduct.set(
            item.product_id,
            previous + toNumber(item.quantity_per_pax) * toNumber(event.pax),
          );
        }
      }

      const projectedStockouts7d = products.filter((product) => {
        const stock = toNumber(product.current_stock);
        const forecastDemand = demandByProduct.get(product.id) ?? 0;
        return stock - forecastDemand < 0;
      }).length;

      const forecastByDate = new Map<string, number>();
      for (const row of (forecastsPast7dResult.data ?? []) as Array<{
        forecast_date: string;
        breakfast_pax: number | null;
      }>) {
        forecastByDate.set(row.forecast_date, toNumber(row.breakfast_pax));
      }

      const actualByDate = new Map<string, number>();
      for (const row of (eventsPast7dResult.data ?? []) as Array<{ event_date: string; pax: number | null }>) {
        const prev = actualByDate.get(row.event_date) ?? 0;
        actualByDate.set(row.event_date, prev + toNumber(row.pax));
      }

      const allDates = new Set<string>([
        ...forecastByDate.keys(),
        ...actualByDate.keys(),
      ]);

      let forecastTotal = 0;
      let actualTotal = 0;
      for (const date of allDates) {
        forecastTotal += forecastByDate.get(date) ?? 0;
        actualTotal += actualByDate.get(date) ?? 0;
      }

      const forecastDeviationAbs7d = actualTotal - forecastTotal;
      const forecastDeviationPct7d =
        forecastTotal > 0 ? (forecastDeviationAbs7d / forecastTotal) * 100 : null;

      const overdueDeliveries = overdueDeliveriesResult.data?.length ?? 0;
      const criticalExpiry = criticalExpiryResult.data?.length ?? 0;
      const pendingHighTasks = pendingHighTasksResult.data?.length ?? 0;
      const upcomingEventsWithoutMenu = ((upcomingEventsResult.data ?? []) as Array<{
        menu_id: string | null;
      }>).filter((event) => !event.menu_id).length;

      const alerts: PrioritizedAlert[] = [];

      if (stockoutsToday > 0) {
        alerts.push({
          id: "stockout_today",
          severity: "critical",
          title: `${stockoutsToday} roturas de stock hoy`,
          detail: "Productos sin stock disponible en este momento.",
          ctaLabel: "Crear compra",
          ctaTo: "/purchases?quick=new-purchase",
        });
      }

      if (overdueDeliveries > 0) {
        alerts.push({
          id: "late_deliveries",
          severity: "critical",
          title: `${overdueDeliveries} entregas retrasadas`,
          detail: "Pedidos en estado ordered con fecha vencida.",
          ctaLabel: "Revisar compras",
          ctaTo: "/purchases",
        });
      }

      if (criticalExpiry > 0) {
        alerts.push({
          id: "critical_expiry",
          severity: "critical",
          title: `${criticalExpiry} caducidades ≤ 48h`,
          detail: "Lotes con riesgo de merma inmediata.",
          ctaLabel: "Ver inventario",
          ctaTo: "/inventory",
        });
      }

      if (projectedStockouts7d > 0) {
        alerts.push({
          id: "projected_stockout_7d",
          severity: "medium",
          title: `${projectedStockouts7d} posibles roturas en 7d`,
          detail: "Proyección por demanda de menús sobre eventos próximos.",
          ctaLabel: "Ajustar compras",
          ctaTo: "/purchases?quick=new-purchase",
        });
      }

      if (pendingHighTasks > 0) {
        alerts.push({
          id: "pending_high_tasks",
          severity: "medium",
          title: `${pendingHighTasks} tareas críticas pendientes`,
          detail: "Tareas de prioridad alta aún sin cerrar.",
          ctaLabel: "Crear/gestionar tarea",
          ctaTo: "/tasks?quick=new-task",
        });
      }

      if (upcomingEventsWithoutMenu > 0) {
        alerts.push({
          id: "events_without_menu",
          severity: "low",
          title: `${upcomingEventsWithoutMenu} eventos sin menú`,
          detail: "Eventos próximos sin asignación de menú.",
          ctaLabel: "Completar eventos",
          ctaTo: "/events",
        });
      }

      return {
        estimatedDailyCost,
        estimatedWasteEuro30d,
        estimatedWastePct30d,
        stockoutsToday,
        projectedStockouts7d,
        forecastDeviationPct7d,
        forecastDeviationAbs7d,
        forecastReference: "Proxy: eventos confirmados vs forecast desayuno (7d)",
        alerts: sortAlerts(alerts),
      };
    },
  });
}
