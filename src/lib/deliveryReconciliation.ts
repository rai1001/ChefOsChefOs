export interface ExpectedDeliveryItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number | null;
}

export interface ParsedDeliveryItem {
  name: string;
  quantity: number;
  unitPrice?: number | null;
}

export interface ReconciliationMatch {
  expected: ExpectedDeliveryItem;
  received: ParsedDeliveryItem;
  quantityDelta: number;
  priceDelta: number | null;
}

export interface DeliveryReconciliationResult {
  matched: ReconciliationMatch[];
  missing: ExpectedDeliveryItem[];
  unexpected: ParsedDeliveryItem[];
  hasIssues: boolean;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function namesAreClose(left: string, right: string): boolean {
  const a = normalize(left);
  const b = normalize(right);
  return a.includes(b) || b.includes(a);
}

export function reconcileDelivery(
  expected: ExpectedDeliveryItem[],
  parsed: ParsedDeliveryItem[],
): DeliveryReconciliationResult {
  const used = new Set<number>();
  const matched: ReconciliationMatch[] = [];
  const missing: ExpectedDeliveryItem[] = [];

  for (const item of expected) {
    const index = parsed.findIndex((candidate, i) => !used.has(i) && namesAreClose(item.name, candidate.name));
    if (index === -1) {
      missing.push(item);
      continue;
    }

    used.add(index);
    const received = parsed[index];
    const priceDelta =
      item.unitPrice == null || received.unitPrice == null
        ? null
        : Number((received.unitPrice - item.unitPrice).toFixed(2));

    matched.push({
      expected: item,
      received,
      quantityDelta: Number((received.quantity - item.quantity).toFixed(2)),
      priceDelta,
    });
  }

  const unexpected = parsed.filter((_, idx) => !used.has(idx));

  const hasIssues =
    missing.length > 0 ||
    unexpected.length > 0 ||
    matched.some((entry) => entry.quantityDelta !== 0 || (entry.priceDelta ?? 0) !== 0);

  return { matched, missing, unexpected, hasIssues };
}
