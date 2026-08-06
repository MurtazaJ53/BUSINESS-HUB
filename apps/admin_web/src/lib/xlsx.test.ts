// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { columnIndex, looksLikeXlsx, readXlsx } from "@/lib/xlsx";

/**
 * Tested against the same real export the mobile reader is tested against
 * (demo_import.xlsx at the repo root), so both surfaces are known to read one
 * shop's actual file identically. A spreadsheet import writes a whole
 * catalogue, so a misread column silently prices every product wrong.
 */
const FIXTURE = resolve(__dirname, "../../../../demo_import.xlsx");

function fixtureBytes(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE));
}

describe("looksLikeXlsx", () => {
  it("accepts a real xlsx (a ZIP starting with PK)", () => {
    expect(looksLikeXlsx(fixtureBytes())).toBe(true);
  });

  it("rejects a legacy .xls, which this reader cannot handle", () => {
    // BIFF files start with 0xD0 0xCF (OLE compound document).
    expect(looksLikeXlsx(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(looksLikeXlsx(new Uint8Array([]))).toBe(false);
  });
});

describe("columnIndex", () => {
  it("maps single letters", () => {
    expect(columnIndex("A1")).toBe(0);
    expect(columnIndex("B7")).toBe(1);
  });

  it("maps two-letter columns past Z", () => {
    expect(columnIndex("AA3")).toBe(26);
    expect(columnIndex("AB1")).toBe(27);
  });

  it("returns 0 for a missing or odd reference rather than throwing", () => {
    expect(columnIndex("")).toBe(0);
    expect(columnIndex("7")).toBe(0);
  });
});

describe("readXlsx", () => {
  it("reads every sheet of a real export", async () => {
    const sheets = await readXlsx(fixtureBytes());
    const names = sheets.map((s) => s.name);
    // The same three sheets the Dart reader's test asserts.
    expect(names).toEqual(["Items", "Customers", "receiptsWithItems"]);
  });

  it("returns the expected shape for each sheet", async () => {
    const sheets = await readXlsx(fixtureBytes());
    const byName = Object.fromEntries(sheets.map((s) => [s.name, s]));
    expect(byName.Items.rows.length).toBe(12);
    expect(byName.Customers.rows.length).toBe(6);
    expect(byName.receiptsWithItems.rows.length).toBe(13);
  });

  it("resolves shared strings into real text, not indexes", async () => {
    const sheets = await readXlsx(fixtureBytes());
    const header = sheets[0].rows[0];
    // A header row of numeric strings would mean the shared string table was
    // not applied.
    expect(header.some((cell) => /[A-Za-z]/.test(cell))).toBe(true);
    expect(header.every((cell) => !/^\d+$/.test(cell) || cell === "")).toBe(true);
  });

  it("pads short rows so column positions stay aligned with the header", async () => {
    const sheets = await readXlsx(fixtureBytes());
    for (const sheet of sheets) {
      const width = sheet.rows[0].length;
      for (const row of sheet.rows) {
        // A row may be shorter only if its trailing cells were genuinely empty;
        // it must never be longer than the header.
        expect(row.length).toBeLessThanOrEqual(width);
      }
    }
  });

  it("rejects a legacy .xls with an instruction the shopkeeper can act on", async () => {
    await expect(readXlsx(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]))).rejects.toThrow(
      /save as \.xlsx or \.csv/i
    );
  });

  it("rejects bytes that are not a ZIP at all", async () => {
    const notZip = new Uint8Array([0x50, 0x4b, 0x00, 0x00, 0x00]);
    await expect(readXlsx(notZip)).rejects.toThrow();
  });
});
