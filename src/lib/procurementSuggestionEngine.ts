export interface ProcurementSignal {
  productId: string;
  productName: string;
  forecastQty: number;
  eventQty: number;
  menuQty: number;
  currentQty: number;
  reservedQty?: number;
  safetyStockQty?: number;
  leadTimeDays?: number;
  dailyDemandRate?: number;
  packSize?: number;
  minOrderQty?: number;
}

export interface ProcurementSuggestion {
  productId: string;
  productName: string;
  required_qty: number;
  current_qty: number;
  recommended_qty: number;
  reason: string;
}

function roundToPack(qty: number, packSize: number): number {
  if (qty <= 0) return 0;
  if (packSize <= 1) return Math.ceil(qty);
  return Math.ceil(qty / packSize) * packSize;
}

export function calculateSuggestedQty(signal: ProcurementSignal): number {
  const demand =
    signal.forecastQty +
    signal.eventQty +
    signal.menuQty +
    (signal.safetyStockQty ?? 0) +
    (signal.leadTimeDays ?? 0) * (signal.dailyDemandRate ?? 0);

  const usableStock = Math.max(signal.currentQty - (signal.reservedQty ?? 0), 0);
  const required = Math.max(demand - usableStock, 0);
  const withMinOrder = Math.max(required, signal.minOrderQty ?? 0);

  return roundToPack(withMinOrder, signal.packSize ?? 1);
}

export function generateProcurementSuggestions(
  signals: ProcurementSignal[],
): ProcurementSuggestion[] {
  return signals.map((signal) => {
    const recommended = calculateSuggestedQty(signal);
    const demand =
      signal.forecastQty +
      signal.eventQty +
      signal.menuQty +
      (signal.safetyStockQty ?? 0) +
      (signal.leadTimeDays ?? 0) * (signal.dailyDemandRate ?? 0);

    return {
      productId: signal.productId,
      productName: signal.productName,
      required_qty: Number(demand.toFixed(2)),
      current_qty: Number(signal.currentQty.toFixed(2)),
      recommended_qty: Number(recommended.toFixed(2)),
      reason: `Demanda ${demand.toFixed(2)} vs stock utilizable ${Math.max(signal.currentQty - (signal.reservedQty ?? 0), 0).toFixed(2)}`,
    };
  });
}
