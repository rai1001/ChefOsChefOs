export interface ProductThresholdInput {
  minStock: number | null;
  optimalStock: number | null;
  criticalStock: number | null;
  categoryMinStock?: number | null;
  categoryOptimalStock?: number | null;
  categoryCriticalStock?: number | null;
}

export interface ResolvedStockThresholds {
  minStock: number;
  optimalStock: number;
  criticalStock: number;
}

export type StockSeverity = "critical" | "medium" | "low" | "healthy";

function toSafeNumber(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

export function resolveStockThresholds(input: ProductThresholdInput): ResolvedStockThresholds {
  const minCandidate = toSafeNumber(input.minStock) || toSafeNumber(input.categoryMinStock);
  const optimalCandidate =
    toSafeNumber(input.optimalStock) || toSafeNumber(input.categoryOptimalStock) || minCandidate;
  const criticalCandidate =
    toSafeNumber(input.criticalStock) ||
    toSafeNumber(input.categoryCriticalStock) ||
    (minCandidate > 0 ? minCandidate * 0.4 : 0);

  const minStock = Math.max(minCandidate, criticalCandidate);
  const optimalStock = Math.max(optimalCandidate, minStock);
  const criticalStock = Math.min(criticalCandidate, minStock);

  return {
    minStock: Number(minStock.toFixed(2)),
    optimalStock: Number(optimalStock.toFixed(2)),
    criticalStock: Number(criticalStock.toFixed(2)),
  };
}

export function getStockSeverity(currentStock: number | null, thresholds: ResolvedStockThresholds): StockSeverity {
  const stock = toSafeNumber(currentStock);
  if (stock <= thresholds.criticalStock) return "critical";
  if (stock <= thresholds.minStock) return "medium";
  if (stock < thresholds.optimalStock) return "low";
  return "healthy";
}

export function calculateSuggestedReplenishment(currentStock: number | null, thresholds: ResolvedStockThresholds): number {
  const stock = toSafeNumber(currentStock);
  const qty = Math.max(thresholds.optimalStock - stock, 0);
  return Number(qty.toFixed(2));
}
