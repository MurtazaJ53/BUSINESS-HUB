/**
 * Code 128 barcode encoding, rendered as SVG.
 *
 * No dependency, for two reasons: the Content-Security-Policy blocks scripts
 * from any other origin, and SVG stays crisp at printer resolution where a
 * canvas bitmap would be fuzzy at the exact moment it matters — a label a
 * scanner has to read.
 *
 * Code 128 rather than EAN-13 because shop SKUs are rarely 13 digits and are
 * often alphanumeric ("KUR-RED-M"). EAN-13 could not encode that at all.
 */

/**
 * Bar and space widths for Code 128 values 0..106.
 *
 * Each entry is six digits: bar, space, bar, space, bar, space, in modules.
 * The final entry (106, the stop pattern) has seven. Every pattern is exactly
 * 11 modules wide except the stop, which is 13 — `barcode.test.ts` asserts
 * that for all 107 entries, which is what catches a mistyped digit in a table
 * this dense.
 */
export const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213",
  "122312", "132212", "221213", "221312", "231212", "112232", "122132",
  "122231", "113222", "123122", "123221", "223211", "221132", "221231",
  "213212", "223112", "312131", "311222", "321122", "321221", "312212",
  "322112", "322211", "212123", "212321", "232121", "111323", "131123",
  "131321", "112313", "132113", "132311", "211313", "231113", "231311",
  "112133", "112331", "132131", "113123", "113321", "133121", "313121",
  "211331", "231131", "213113", "213311", "213131", "311123", "311321",
  "331121", "312113", "312311", "332111", "314111", "221411", "431111",
  "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114",
  "413111", "241112", "134111", "111242", "121142", "121241", "114212",
  "124112", "124211", "411212", "421112", "421211", "212141", "214121",
  "412121", "111143", "111341", "131141", "114113", "114311", "411113",
  "411311", "113141", "114131", "311141", "411131", "211412", "211214",
  "211232", "2331112",
];

const START_B = 104;
const START_C = 105;
const STOP = 106;

/** Code set B covers printable ASCII; the value is simply the offset from a space. */
const CODE_B_MIN = 32;
const CODE_B_MAX = 126;

export class BarcodeError extends Error {}

/**
 * Pick the code set.
 *
 * C packs two digits into one symbol, halving the width — which is the
 * difference between fitting and not fitting on a 40mm garment tag. It only
 * applies to an even number of digits, so anything else falls back to B.
 */
function chooseValues(text: string): number[] {
  if (text.length >= 2 && text.length % 2 === 0 && /^[0-9]+$/.test(text)) {
    const values = [START_C];
    for (let i = 0; i < text.length; i += 2) {
      values.push(Number(text.slice(i, i + 2)));
    }
    return values;
  }

  const values = [START_B];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < CODE_B_MIN || code > CODE_B_MAX) {
      throw new BarcodeError(
        `"${char}" cannot go in a barcode. Use letters, numbers and basic punctuation.`,
      );
    }
    values.push(code - CODE_B_MIN);
  }
  return values;
}

/**
 * Turn text into the full run of module widths, check digit and stop included.
 *
 * The check character is a weighted sum: the start value plus each data value
 * multiplied by its 1-based position, modulo 103. Scanners reject a symbol
 * whose check character does not match, so getting this wrong produces a
 * barcode that looks perfect and never scans.
 */
export function encodeCode128(text: string): string {
  if (!text) throw new BarcodeError("Nothing to encode.");

  const values = chooseValues(text);
  let checksum = values[0];
  for (let i = 1; i < values.length; i += 1) {
    checksum += values[i] * i;
  }
  values.push(checksum % 103, STOP);

  return values.map((value) => PATTERNS[value]).join("");
}

export type BarcodeSvgOptions = {
  /** Width of one module in user units. Under ~1 the print is unreliable. */
  moduleWidth?: number;
  height?: number;
};

/**
 * Render `text` as a self-contained SVG string.
 *
 * Bars are drawn as filled rects rather than a single path so that a viewer
 * scaling the SVG cannot introduce gaps between adjacent bars through
 * rounding — a gap is a misread.
 */
export function barcodeSvg(text: string, options: BarcodeSvgOptions = {}): string {
  const moduleWidth = options.moduleWidth ?? 2;
  const height = options.height ?? 60;
  const modules = encodeCode128(text);

  const rects: string[] = [];
  let x = 0;
  let isBar = true; // Every Code 128 pattern starts with a bar.

  for (const digit of modules) {
    const width = Number(digit) * moduleWidth;
    if (isBar) {
      rects.push(
        `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000"/>`,
      );
    }
    x += width;
    isBar = !isBar;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${height}" ` +
    `viewBox="0 0 ${x} ${height}" shape-rendering="crispEdges">${rects.join("")}</svg>`
  );
}

/** The same SVG as a data URI, for use in an <img src>. */
export function barcodeDataUri(text: string, options: BarcodeSvgOptions = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(barcodeSvg(text, options))}`;
}

/**
 * What a scanner will actually read back, or null if it cannot be encoded.
 *
 * Used to decide whether an item can have a label printed at all, without
 * throwing inside a render.
 */
export function canEncode(text: string): boolean {
  try {
    encodeCode128(text);
    return true;
  } catch {
    return false;
  }
}
