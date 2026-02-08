export interface EventCostVarianceInput {
  eventId: string;
  pax: number;
  baselineCostTotal: number;
  actualCostTotal: number;
}

export interface ItemCost {
  productId: string;
  baselineCost: number;
  actualCost: number;
}

export interface EventCostVarianceResult {
  eventId: string;
  baselineCostTotal: number;
  actualCostTotal: number;
  deltaAmount: number;
  deltaPct: number | null;
  baselineCostPerPax: number;
  actualCostPerPax: number;
}

export interface ProductDeviation {
  productId: string;
  deltaAmount: number;
  deltaPct: number | null;
}

export function calculateEventCostVariance(
  input: EventCostVarianceInput,
): EventCostVarianceResult {
  const baseline = Math.max(input.baselineCostTotal, 0);
  const actual = Math.max(input.actualCostTotal, 0);
  const deltaAmount = Number((actual - baseline).toFixed(2));
  const deltaPct =
    baseline === 0 ? null : Number((((actual - baseline) / baseline) * 100).toFixed(2));
  const paxSafe = input.pax > 0 ? input.pax : 1;

  return {
    eventId: input.eventId,
    baselineCostTotal: baseline,
    actualCostTotal: actual,
    deltaAmount,
    deltaPct,
    baselineCostPerPax: Number((baseline / paxSafe).toFixed(2)),
    actualCostPerPax: Number((actual / paxSafe).toFixed(2)),
  };
}

export function getTopProductDeviations(
  items: ItemCost[],
  limit: number = 3,
): ProductDeviation[] {
  return items
    .map((item) => {
      const deltaAmount = Number((item.actualCost - item.baselineCost).toFixed(2));
      const deltaPct =
        item.baselineCost === 0
          ? null
          : Number((((item.actualCost - item.baselineCost) / item.baselineCost) * 100).toFixed(2));
      return { productId: item.productId, deltaAmount, deltaPct };
    })
    .sort((a, b) => Math.abs(b.deltaAmount) - Math.abs(a.deltaAmount))
    .slice(0, limit);
}
