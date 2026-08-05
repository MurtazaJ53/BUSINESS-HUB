import { describe, expect, it } from "vitest";

import { buildReorderMessage } from "@/components/reorder-list";

/**
 * This text is sent to a real supplier. A wrong quantity here is a wrong
 * delivery, so the format is pinned rather than left to drift.
 */

type Row = Parameters<typeof buildReorderMessage>[1][number];

function row(overrides: Partial<Row> = {}): Row {
  return {
    id: "i1",
    name: "Cotton Shirt",
    sku: "",
    category: "General",
    unit: "",
    stock: "2",
    reorder_level: 10,
    uses_default_level: false,
    suggested_qty: "18",
    cost_price: null,
    estimated_cost: null,
    out_of_stock: false,
    ...overrides,
  };
}

describe("buildReorderMessage", () => {
  it("names the shop and lists each item with its quantity", () => {
    const text = buildReorderMessage("Sharma Garments", [row()]);
    expect(text).toContain("*Sharma Garments* - stock order");
    expect(text).toContain("- Cotton Shirt: 18");
    expect(text).toContain("Please confirm availability and rate. Thank you.");
  });

  it("includes the SKU so the supplier picks the right article", () => {
    expect(buildReorderMessage("Shop", [row({ sku: "CS-42" })])).toContain(
      "- Cotton Shirt (CS-42): 18"
    );
  });

  it("appends the unit, because 18 kg and 18 pieces are different orders", () => {
    expect(buildReorderMessage("Shop", [row({ unit: "kg" })])).toContain(
      "- Cotton Shirt: 18 kg"
    );
  });

  it("falls back to a generic name rather than sending an empty asterisk", () => {
    expect(buildReorderMessage("   ", [row()])).toContain("*our shop* - stock order");
  });

  it("says there is nothing to order rather than sending a blank list", () => {
    expect(buildReorderMessage("Shop", [])).toBe("Nothing to reorder for Shop right now.");
  });

  it("keeps fractional quantities readable", () => {
    expect(buildReorderMessage("Shop", [row({ suggested_qty: "2.500", unit: "kg" })])).toContain(
      "- Cotton Shirt: 2.5 kg"
    );
  });
});
