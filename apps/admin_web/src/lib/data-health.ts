import type { Customer, InventoryItem } from "@/lib/types";

/**
 * Mirrors `apps/mobile_flutter/lib/core/health/data_health.dart`. The two must
 * agree: an owner who merges duplicates on the phone and then opens the web
 * page should not be told there is still a problem.
 */

export type DuplicateGroup = {
  /** What made them match — SKU, or name + size. */
  key: string;
  items: InventoryItem[];
  /** The copy worth keeping: most stock, then oldest. */
  keeper: InventoryItem;
  duplicates: InventoryItem[];
  copies: number;
  combinedStock: number;
};

export type DataHealthReport = {
  duplicateGroups: DuplicateGroup[];
  negativeStock: InventoryItem[];
  missingPrice: InventoryItem[];
  customersWithoutPhone: Customer[];
  /** Extra rows that shouldn't exist (a group of 3 copies is 2 too many). */
  duplicateRowCount: number;
  totalIssues: number;
  isHealthy: boolean;
};

function normalise(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function num(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = parseFloat(String(value ?? "0"));
  return Number.isFinite(parsed) ? parsed : 0;
}

function stockOf(item: InventoryItem): number {
  return num(item.stock_on_hand);
}

function buildGroup(key: string, items: InventoryItem[]): DuplicateGroup {
  // Most stock first, then oldest — usually the original row with real history
  // behind it. Items without a created_at sort last rather than winning by
  // accident.
  const sorted = [...items].sort((a, b) => {
    const byStock = stockOf(b) - stockOf(a);
    if (byStock !== 0) return byStock;
    const aCreated = a.created_at ?? "";
    const bCreated = b.created_at ?? "";
    if (aCreated === bCreated) return 0;
    if (!aCreated) return 1;
    if (!bCreated) return -1;
    return aCreated < bCreated ? -1 : 1;
  });
  const keeper = sorted[0];
  return {
    key,
    items,
    keeper,
    duplicates: items.filter((i) => i.id !== keeper.id),
    copies: items.length,
    combinedStock: items.reduce((sum, i) => sum + stockOf(i), 0),
  };
}

/**
 * Find inventory rows that are really the same product.
 *
 * Matches on SKU when there is one, otherwise on name + size — the same rule
 * the importer uses. Size matters: a garment shop's S and XL are different
 * products, not duplicates.
 */
export function findDuplicateItems(items: InventoryItem[]): DuplicateGroup[] {
  const bySku = new Map<string, InventoryItem[]>();
  const byName = new Map<string, InventoryItem[]>();

  for (const item of items) {
    const sku = normalise(item.sku);
    if (sku) {
      const bucket = bySku.get(sku);
      if (bucket) bucket.push(item);
      else bySku.set(sku, [item]);
      continue;
    }
    const name = normalise(item.name);
    if (!name) continue;
    const key = `${name}|${normalise(item.size)}`;
    const bucket = byName.get(key);
    if (bucket) bucket.push(item);
    else byName.set(key, [item]);
  }

  const groups: DuplicateGroup[] = [];
  for (const [key, group] of bySku) {
    if (group.length > 1) groups.push(buildGroup(key, group));
  }
  for (const [key, group] of byName) {
    if (group.length > 1) groups.push(buildGroup(key, group));
  }

  // Worst first: the most copies, then the most stock at stake.
  groups.sort((a, b) => b.copies - a.copies || b.combinedStock - a.combinedStock);
  return groups;
}

export function buildDataHealthReport(
  items: InventoryItem[],
  customers: Customer[]
): DataHealthReport {
  const duplicateGroups = findDuplicateItems(items);
  const negativeStock = items.filter((i) => stockOf(i) < 0);
  // A zero price means the till will happily ring up a free sale.
  const missingPrice = items.filter((i) => num(i.sell_price) <= 0);
  // Only customers who owe money: a walk-in with no number isn't a problem,
  // but a debt you can't chase is.
  const customersWithoutPhone = customers.filter(
    (c) =>
      num(c.balance ?? c.balance_amount) > 0.009 &&
      (c.phone ?? "").trim().length < 10
  );

  const duplicateRowCount = duplicateGroups.reduce(
    (sum, g) => sum + g.copies - 1,
    0
  );
  const totalIssues =
    duplicateRowCount +
    negativeStock.length +
    missingPrice.length +
    customersWithoutPhone.length;

  return {
    duplicateGroups,
    negativeStock,
    missingPrice,
    customersWithoutPhone,
    duplicateRowCount,
    totalIssues,
    isHealthy: totalIssues === 0,
  };
}
