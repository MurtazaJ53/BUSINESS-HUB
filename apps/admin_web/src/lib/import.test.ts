import { describe, expect, it } from "vitest";

import {
  applyMapping,
  autoMap,
  normalizeHeader,
  parseCsv,
  parseNumber,
  toCustomerPayload,
  toInventoryPayload,
} from "@/lib/import";

/**
 * An import writes a shop's entire catalog in one go. A mis-mapped column
 * silently prices every product wrong, so the mapping rules are pinned here —
 * and they must agree with universal_import.dart, or the same file would
 * import differently on the phone.
 */

describe("parseCsv", () => {
  it("reads headers and rows", () => {
    const table = parseCsv("Name,Price\nShirt,499\nCap,199");
    expect(table.headers).toEqual(["Name", "Price"]);
    expect(table.rows).toEqual([
      ["Shirt", "499"],
      ["Cap", "199"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    // An address column breaks any naive split.
    const table = parseCsv('Name,Address\nRaj,"Shop 4, Main Road"');
    expect(table.rows[0]).toEqual(["Raj", "Shop 4, Main Road"]);
  });

  it("handles escaped quotes", () => {
    const table = parseCsv('Name\n"He said ""hello"""');
    expect(table.rows[0][0]).toBe('He said "hello"');
  });

  it("handles a newline inside a quoted field", () => {
    const table = parseCsv('Name,Note\nRaj,"line one\nline two"');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0][1]).toBe("line one\nline two");
  });

  it("strips the BOM Excel writes, which would corrupt the first header", () => {
    const table = parseCsv("﻿Name,Price\nShirt,499");
    expect(table.headers[0]).toBe("Name");
  });

  it("handles CRLF line endings", () => {
    const table = parseCsv("Name,Price\r\nShirt,499\r\n");
    expect(table.headers).toEqual(["Name", "Price"]);
    expect(table.rows).toEqual([["Shirt", "499"]]);
  });

  it("drops blank spacer rows", () => {
    const table = parseCsv("Name,Price\nShirt,499\n,\nCap,199");
    expect(table.rows).toHaveLength(2);
  });

  it("reads a final row with no trailing newline", () => {
    expect(parseCsv("Name\nShirt").rows).toEqual([["Shirt"]]);
  });
});

describe("normalizeHeader", () => {
  it("collapses spacing, case and punctuation", () => {
    for (const variant of ["Item Name", "item_name", "ITEM-NAME", "  item name  "]) {
      expect(normalizeHeader(variant)).toBe("itemname");
    }
  });
});

describe("autoMap", () => {
  it("maps obvious headers", () => {
    const mapping = autoMap(["Item Name", "MRP", "Qty", "Code"], "products");
    expect(mapping.name).toBe(0);
    expect(mapping.price).toBe(1);
    expect(mapping.stock).toBe(2);
    expect(mapping.sku).toBe(3);
  });

  it("prefers an exact header over a fuzzy one", () => {
    // "Selling Price" must not steal the column literally called "Price".
    const mapping = autoMap(["Name", "Selling Price", "Price"], "products");
    expect(mapping.price).toBe(2);
  });

  it("matches a decorated header by substring", () => {
    const mapping = autoMap(["Product Name", "Selling Price (INR)"], "products");
    expect(mapping.name).toBe(0);
    expect(mapping.price).toBe(1);
  });

  it("never assigns one column to two fields", () => {
    const mapping = autoMap(["Name", "Amount"], "products");
    const used = Object.values(mapping);
    expect(new Set(used).size).toBe(used.length);
  });

  it("leaves absent fields unmapped rather than guessing", () => {
    const mapping = autoMap(["Name"], "products");
    expect(mapping.stock).toBeUndefined();
    expect(mapping.price).toBeUndefined();
  });

  it("maps a customer sheet", () => {
    const mapping = autoMap(["Party Name", "Mobile Number", "Closing Balance"], "customers");
    expect(mapping.name).toBe(0);
    expect(mapping.phone).toBe(1);
    expect(mapping.amountDue).toBe(2);
  });
});

describe("parseNumber", () => {
  it("strips grouping separators and currency symbols", () => {
    expect(parseNumber("1,234.50")).toBe(1234.5);
    expect(parseNumber("₹1234")).toBe(1234);
  });

  it("reads accounting negatives", () => {
    expect(parseNumber("(50)")).toBe(-50);
  });

  it("treats blanks and junk as zero rather than NaN", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
    expect(parseNumber("n/a")).toBe(0);
  });
});

describe("applyMapping", () => {
  const table = parseCsv("Name,Price\nShirt,499\n,199\nCap,199");

  it("skips rows missing a required field", () => {
    // A row with no name is a spacer or a totals line, not a product.
    const result = applyMapping(table, "products", autoMap(table.headers, "products"));
    expect(result.rows).toHaveLength(2);
    expect(result.skipped).toBe(1);
  });
});

describe("payload shaping", () => {
  it("sends prices as two-decimal strings", () => {
    const payload = toInventoryPayload({ name: "Shirt", price: "499", stock: "10" });
    expect(payload.sell_price).toBe("499.00");
    expect(payload.opening_stock).toBe(10);
  });

  it("defaults a blank category rather than sending an empty one", () => {
    expect(toInventoryPayload({ name: "Shirt", category: "  " }).category).toBe("General");
  });

  it("omits a zero cost, because that means 'not recorded'", () => {
    expect(toInventoryPayload({ name: "Shirt", costPrice: "0" })).not.toHaveProperty(
      "private_cost_price"
    );
    expect(toInventoryPayload({ name: "Shirt", costPrice: "300" }).private_cost_price).toBe(
      "300.00"
    );
  });

  it("treats a customer advance as a negative balance", () => {
    // An advance is money the shop holds, not money it is owed.
    expect(toCustomerPayload({ name: "Raj", advance: "500" }).opening_balance).toBe("-500.00");
    expect(toCustomerPayload({ name: "Raj", amountDue: "500" }).opening_balance).toBe("500.00");
  });
});
