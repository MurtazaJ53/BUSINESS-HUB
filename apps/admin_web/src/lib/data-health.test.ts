import { describe, expect, it } from "vitest";

import { buildDataHealthReport, findDuplicateItems } from "@/lib/data-health";
import type { Customer, InventoryItem } from "@/lib/types";

/**
 * These rules exist twice — here and in the mobile app's Dart. They must agree,
 * or an owner who cleans up on the phone gets told there is still a problem on
 * the web. Every case below is one where a wrong answer costs real money.
 */

let seq = 0;
function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  seq += 1;
  return {
    id: `item-${seq}`,
    name: `Item ${seq}`,
    sku: "",
    barcode: "",
    category: "General",
    subcategory: "",
    size: "",
    description: "",
    sell_price: "100.00",
    status: "active",
    tombstone: false,
    source_meta_json: {},
    stock_on_hand: 10,
    cost_price: null,
    supplier_id: null,
    last_purchase_date: null,
    ...overrides,
  };
}

function customer(overrides: Partial<Customer> = {}): Customer {
  seq += 1;
  return { id: `cust-${seq}`, name: `Customer ${seq}`, phone: "", ...overrides };
}

describe("findDuplicateItems", () => {
  it("matches on SKU regardless of name or case", () => {
    const groups = findDuplicateItems([
      item({ sku: "ABC-1", name: "Cotton Shirt" }),
      item({ sku: "abc-1", name: "cotton shirt (new)" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].copies).toBe(2);
  });

  it("does not merge different sizes of the same garment", () => {
    // A shop's S and XL are different products. Merging them would destroy the
    // size breakdown and produce one row with impossible stock.
    expect(
      findDuplicateItems([
        item({ name: "Kurta", size: "S" }),
        item({ name: "Kurta", size: "XL" }),
      ])
    ).toEqual([]);
  });

  it("matches on name plus size when there is no SKU", () => {
    const groups = findDuplicateItems([
      item({ name: "Kurta", size: "S" }),
      item({ name: " kurta ", size: "s" }),
    ]);
    expect(groups).toHaveLength(1);
  });

  it("never groups two items that both have SKUs but different ones", () => {
    expect(
      findDuplicateItems([
        item({ sku: "A", name: "Same Name" }),
        item({ sku: "B", name: "Same Name" }),
      ])
    ).toEqual([]);
  });

  it("ignores nameless rows with no SKU rather than lumping them together", () => {
    expect(findDuplicateItems([item({ name: "" }), item({ name: "   " })])).toEqual([]);
  });

  it("keeps the copy with the most stock", () => {
    const [group] = findDuplicateItems([
      item({ id: "thin", sku: "S1", stock_on_hand: 2 }),
      item({ id: "fat", sku: "S1", stock_on_hand: 40 }),
    ]);
    expect(group.keeper.id).toBe("fat");
    expect(group.duplicates.map((d) => d.id)).toEqual(["thin"]);
  });

  it("breaks a stock tie by keeping the oldest row", () => {
    const [group] = findDuplicateItems([
      item({ id: "new", sku: "S1", stock_on_hand: 5, created_at: "2026-05-01T00:00:00Z" }),
      item({ id: "old", sku: "S1", stock_on_hand: 5, created_at: "2024-01-01T00:00:00Z" }),
    ]);
    expect(group.keeper.id).toBe("old");
  });

  it("combines stock across every copy", () => {
    const [group] = findDuplicateItems([
      item({ sku: "S1", stock_on_hand: 3 }),
      item({ sku: "S1", stock_on_hand: 4 }),
      item({ sku: "S1", stock_on_hand: 5 }),
    ]);
    expect(group.combinedStock).toBe(12);
    expect(group.copies).toBe(3);
  });

  it("puts the worst group first", () => {
    const groups = findDuplicateItems([
      item({ sku: "PAIR", stock_on_hand: 1 }),
      item({ sku: "PAIR", stock_on_hand: 1 }),
      item({ sku: "TRIPLE", stock_on_hand: 1 }),
      item({ sku: "TRIPLE", stock_on_hand: 1 }),
      item({ sku: "TRIPLE", stock_on_hand: 1 }),
    ]);
    expect(groups[0].key).toBe("triple");
  });
});

describe("buildDataHealthReport", () => {
  it("counts extra rows, not groups", () => {
    // Three copies of one product is two rows too many, not one problem.
    const report = buildDataHealthReport(
      [
        item({ sku: "S1" }),
        item({ sku: "S1" }),
        item({ sku: "S1" }),
      ],
      []
    );
    expect(report.duplicateRowCount).toBe(2);
    expect(report.totalIssues).toBe(2);
  });

  it("flags negative stock", () => {
    const report = buildDataHealthReport([item({ stock_on_hand: -3 })], []);
    expect(report.negativeStock).toHaveLength(1);
  });

  it("flags a zero price, which would ring up as free", () => {
    const report = buildDataHealthReport([item({ sell_price: "0.00" })], []);
    expect(report.missingPrice).toHaveLength(1);
  });

  it("does not flag a priced item", () => {
    expect(buildDataHealthReport([item({ sell_price: "0.01" })], []).missingPrice).toEqual([]);
  });

  it("flags a debtor with no reachable number", () => {
    const report = buildDataHealthReport([], [customer({ balance: "500.00", phone: "" })]);
    expect(report.customersWithoutPhone).toHaveLength(1);
  });

  it("ignores a walk-in with no number who owes nothing", () => {
    const report = buildDataHealthReport([], [customer({ balance: "0.00", phone: "" })]);
    expect(report.customersWithoutPhone).toEqual([]);
  });

  it("treats a too-short number as unreachable", () => {
    const report = buildDataHealthReport([], [customer({ balance: "500.00", phone: "98765" })]);
    expect(report.customersWithoutPhone).toHaveLength(1);
  });

  it("accepts a full mobile number", () => {
    const report = buildDataHealthReport(
      [],
      [customer({ balance: "500.00", phone: "9876543210" })]
    );
    expect(report.customersWithoutPhone).toEqual([]);
  });

  it("falls back to balance_amount when balance is absent", () => {
    const report = buildDataHealthReport([], [customer({ balance_amount: 500, phone: "" })]);
    expect(report.customersWithoutPhone).toHaveLength(1);
  });

  it("reports a clean shop as healthy", () => {
    const report = buildDataHealthReport(
      [item({ sku: "A" }), item({ sku: "B" })],
      [customer({ balance: "0.00", phone: "9876543210" })]
    );
    expect(report.isHealthy).toBe(true);
    expect(report.totalIssues).toBe(0);
  });
});
