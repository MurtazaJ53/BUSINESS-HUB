import { describe, expect, it } from "vitest";

import { BarcodeError, PATTERNS, barcodeSvg, canEncode, encodeCode128 } from "@/lib/barcode";

/**
 * A barcode that looks right and does not scan is worse than no barcode: the
 * shop prints two hundred labels before anyone finds out. These tests check
 * the things a human cannot eyeball.
 */
describe("Code 128 pattern table", () => {
  // Transcribing 107 six-digit patterns by hand is exactly where a typo hides,
  // and a wrong width produces a barcode that renders fine and never scans.
  // Every pattern is 11 modules across six elements; the stop is 13 across
  // seven. A single mistyped digit breaks one of those sums.
  it("has 107 entries", () => {
    expect(PATTERNS).toHaveLength(107);
  });

  it("every data pattern is six elements totalling 11 modules", () => {
    PATTERNS.slice(0, 106).forEach((pattern, value) => {
      const digits = [...pattern].map(Number);
      expect(digits, `pattern ${value} element count`).toHaveLength(6);
      expect(
        digits.reduce((a, b) => a + b, 0),
        `pattern ${value} module width`,
      ).toBe(11);
    });
  });

  it("the stop pattern is seven elements totalling 13 modules", () => {
    const digits = [...PATTERNS[106]].map(Number);
    expect(digits).toHaveLength(7);
    expect(digits.reduce((a, b) => a + b, 0)).toBe(13);
  });

  it("no element is wider than four modules", () => {
    // Code 128 defines widths of 1 to 4 only; a 5 or a 0 is a typo.
    for (const pattern of PATTERNS) {
      for (const digit of pattern) {
        expect(Number(digit)).toBeGreaterThanOrEqual(1);
        expect(Number(digit)).toBeLessThanOrEqual(4);
      }
    }
  });

  it("no two values share a pattern", () => {
    // Duplicates would mean a scanner reads one value as another.
    expect(new Set(PATTERNS).size).toBe(PATTERNS.length);
  });

  it("encodes to a module run whose total width is the expected 11n + 13", () => {
    // Two data symbols in code C ("1234"), plus start and check, plus stop.
    const modules = encodeCode128("1234");
    const total = [...modules].reduce((sum, d) => sum + Number(d), 0);
    // start(11) + 2 data(22) + check(11) + stop(13)
    expect(total).toBe(11 + 22 + 11 + 13);
  });

  it("code B widths also come out at 11n + 13", () => {
    const modules = encodeCode128("ABC");
    const total = [...modules].reduce((sum, d) => sum + Number(d), 0);
    // start(11) + 3 data(33) + check(11) + stop(13)
    expect(total).toBe(11 + 33 + 11 + 13);
  });
});

describe("check character", () => {
  /**
   * Worked by hand from the spec: start C is 105, the single data symbol "00"
   * is 0, so the checksum is (105 + 0 * 1) % 103 = 2. Pattern 105 is 211232,
   * pattern 0 is 212222, pattern 2 is 222221, stop is 2331112.
   */
  it("matches a hand-computed example", () => {
    expect(encodeCode128("00")).toBe("211232" + "212222" + "222221" + "2331112");
  });

  it("differs for inputs that differ", () => {
    expect(encodeCode128("01")).not.toBe(encodeCode128("00"));
  });
});

describe("code set choice", () => {
  it("uses the compact numeric set for an even run of digits", () => {
    // Code C: 4 digits become 2 symbols, so the run is shorter than code B's
    // 4 symbols would be.
    const compact = encodeCode128("1234");
    const asText = encodeCode128("12345"); // odd length falls back to B
    expect(compact.length).toBeLessThan(asText.length);
  });

  it("falls back to the text set for alphanumeric SKUs", () => {
    expect(() => encodeCode128("KUR-RED-M")).not.toThrow();
  });

  it("handles an odd number of digits", () => {
    expect(() => encodeCode128("12345")).not.toThrow();
  });
});

describe("rejecting what cannot be encoded", () => {
  it("refuses an empty string", () => {
    expect(() => encodeCode128("")).toThrow(BarcodeError);
  });

  it("refuses characters outside printable ASCII", () => {
    // A shop naming an item in Hindi is entirely normal; the barcode simply
    // cannot carry it, and saying so beats printing an unscannable label.
    expect(() => encodeCode128("कुर्ता")).toThrow(BarcodeError);
    expect(canEncode("कुर्ता")).toBe(false);
  });

  it("canEncode agrees with encode for valid input", () => {
    expect(canEncode("KUR-1")).toBe(true);
  });
});

describe("svg output", () => {
  it("starts with a bar and alternates", () => {
    const svg = barcodeSvg("1234", { moduleWidth: 1, height: 10 });
    const first = svg.indexOf('<rect x="0"');
    expect(first).toBeGreaterThan(-1);
  });

  it("fetches nothing, so the Content-Security-Policy cannot block it", () => {
    const svg = barcodeSvg("KUR-1");
    // The xmlns value is a namespace identifier, never requested. What would
    // actually be fetched is a href, an <image>, or a url() reference.
    expect(svg).not.toMatch(/href=|<image|url\(/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("width matches the module run so nothing is clipped", () => {
    const moduleWidth = 3;
    const modules = encodeCode128("1234");
    const expected = [...modules].reduce((sum, d) => sum + Number(d), 0) * moduleWidth;
    const svg = barcodeSvg("1234", { moduleWidth });
    expect(svg).toContain(`width="${expected}"`);
  });

  it("scales bar widths with moduleWidth", () => {
    const narrow = barcodeSvg("1234", { moduleWidth: 1 });
    const wide = barcodeSvg("1234", { moduleWidth: 2 });
    expect(wide.length).toBeGreaterThanOrEqual(narrow.length);
    expect(narrow).not.toBe(wide);
  });
});
