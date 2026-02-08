export interface WasteRecord {
  productId: string;
  categoryId?: string | null;
  qty: number;
  cause: string;
  recordedAt: string;
}

export interface WasteMetrics {
  totalQty: number;
  byProduct: Array<{ productId: string; qty: number }>;
  byCategory: Array<{ categoryId: string; qty: number }>;
  byCause: Array<{ cause: string; qty: number }>;
}

function groupSum(records: WasteRecord[], getKey: (record: WasteRecord) => string) {
  const map = new Map<string, number>();
  for (const record of records) {
    const key = getKey(record);
    map.set(key, (map.get(key) ?? 0) + record.qty);
  }
  return [...map.entries()]
    .map(([key, qty]) => ({ key, qty }))
    .sort((a, b) => b.qty - a.qty);
}

export function computeWasteMetrics(
  records: WasteRecord[],
  range?: { from?: string; to?: string },
): WasteMetrics {
  const from = range?.from ? new Date(range.from).getTime() : Number.NEGATIVE_INFINITY;
  const to = range?.to ? new Date(range.to).getTime() : Number.POSITIVE_INFINITY;

  const filtered = records.filter((record) => {
    const ts = new Date(record.recordedAt).getTime();
    return ts >= from && ts <= to;
  });

  const byProduct = groupSum(filtered, (record) => record.productId).map((item) => ({
    productId: item.key,
    qty: Number(item.qty.toFixed(2)),
  }));

  const byCategory = groupSum(filtered, (record) => record.categoryId ?? "uncategorized").map(
    (item) => ({
      categoryId: item.key,
      qty: Number(item.qty.toFixed(2)),
    }),
  );

  const byCause = groupSum(filtered, (record) => record.cause).map((item) => ({
    cause: item.key,
    qty: Number(item.qty.toFixed(2)),
  }));

  const totalQty = Number(filtered.reduce((sum, record) => sum + record.qty, 0).toFixed(2));

  return {
    totalQty,
    byProduct,
    byCategory,
    byCause,
  };
}
