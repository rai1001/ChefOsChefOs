export interface MenuVersionItem {
  productId: string;
  quantityPerPax: number;
  costPrice?: number | null;
}

export interface MenuVersionSnapshot {
  versionNumber: number;
  name: string;
  items: MenuVersionItem[];
}

export interface MenuVersionDiff {
  added: MenuVersionItem[];
  removed: MenuVersionItem[];
  changed: Array<{
    productId: string;
    fromQuantity: number;
    toQuantity: number;
  }>;
  estimatedCostDelta: number;
}

export function diffMenuVersions(
  prev: MenuVersionSnapshot,
  next: MenuVersionSnapshot,
): MenuVersionDiff {
  const prevMap = new Map(prev.items.map((item) => [item.productId, item]));
  const nextMap = new Map(next.items.map((item) => [item.productId, item]));

  const added = next.items.filter((item) => !prevMap.has(item.productId));
  const removed = prev.items.filter((item) => !nextMap.has(item.productId));

  const changed = next.items
    .filter((item) => prevMap.has(item.productId))
    .filter((item) => prevMap.get(item.productId)!.quantityPerPax !== item.quantityPerPax)
    .map((item) => ({
      productId: item.productId,
      fromQuantity: prevMap.get(item.productId)!.quantityPerPax,
      toQuantity: item.quantityPerPax,
    }));

  const prevCost = prev.items.reduce(
    (sum, item) => sum + item.quantityPerPax * (item.costPrice ?? 0),
    0,
  );
  const nextCost = next.items.reduce(
    (sum, item) => sum + item.quantityPerPax * (item.costPrice ?? 0),
    0,
  );

  return {
    added,
    removed,
    changed,
    estimatedCostDelta: Number((nextCost - prevCost).toFixed(2)),
  };
}
