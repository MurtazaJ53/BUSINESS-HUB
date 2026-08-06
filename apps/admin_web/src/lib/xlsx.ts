/**
 * A small, dependency-free XLSX reader.
 *
 * Port of `apps/mobile_flutter/lib/core/import/xlsx_reader.dart`. An .xlsx file
 * is a ZIP of XML parts, so we read it directly rather than pulling in a
 * spreadsheet library — the obvious npm option is stale and has a CVE history,
 * and the mobile app already proved a hand-rolled reader handles real exports.
 *
 * Uses only platform APIs: DecompressionStream for the ZIP entries and
 * DOMParser for the XML.
 *
 * Note: dates arrive as Excel serial numbers, the same as on mobile. A caller
 * that needs a real date must convert, or ask the shop to export text.
 */

export type XlsxSheet = {
  name: string;
  /** Row-major strings. Short rows are padded so column indexes line up. */
  rows: string[][];
};

/** True when the bytes look like a ZIP, and therefore a real .xlsx. A legacy
 *  .xls (BIFF) file does not start with "PK" and cannot be read here. */
export function looksLikeXlsx(bytes: Uint8Array): boolean {
  return bytes.length > 1 && bytes[0] === 0x50 && bytes[1] === 0x4b; // 'P','K'
}

type ZipEntry = { name: string; bytes: Uint8Array };

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Read a ZIP via its End of Central Directory record.
 *
 * Scanning local file headers instead would be simpler but unreliable: entries
 * written with a streaming writer set sizes to zero in the local header and
 * put the real values in a trailing data descriptor.
 */
async function readZip(bytes: Uint8Array): Promise<ZipEntry[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Locate the EOCD signature, searching backwards over the comment field.
  let eocd = -1;
  const lowest = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= lowest; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a readable .xlsx file (no ZIP directory).");

  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;

    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);

    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLen)
    );

    // The local header repeats the name/extra lengths, which may differ from
    // the central directory's, so read them again to find the data start.
    const localNameLen = view.getUint16(localOffset + 26, true);
    const localExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);

    if (method === 0) {
      entries.push({ name, bytes: raw });
    } else if (method === 8) {
      entries.push({ name, bytes: await inflateRaw(raw) });
    }
    // Any other compression method is skipped rather than guessed at.

    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("The spreadsheet contains XML this reader cannot parse.");
  }
  return doc;
}

/** Element lookup that ignores namespace prefixes, which writers vary on. */
function elements(root: Document | Element, local: string): Element[] {
  const found = root.getElementsByTagName("*");
  const out: Element[] = [];
  for (let i = 0; i < found.length; i += 1) {
    const el = found[i];
    if ((el.localName || el.nodeName.replace(/^.*:/, "")) === local) out.push(el);
  }
  return out;
}

function attr(el: Element, name: string): string | null {
  return (
    el.getAttribute(name) ??
    el.getAttribute(`r:${name}`) ??
    el.getAttribute(name.replace(/^r:/, "")) ??
    null
  );
}

/** "B7" -> 1, "AA3" -> 26. Returns 0 when the reference is missing or odd. */
export function columnIndex(ref: string): number {
  let index = 0;
  let sawLetter = false;
  for (const ch of ref) {
    const code = ch.charCodeAt(0);
    const upper = code >= 0x41 && code <= 0x5a;
    const lower = code >= 0x61 && code <= 0x7a;
    if (upper || lower) {
      index = index * 26 + (code - (upper ? 0x40 : 0x60));
      sawLetter = true;
    } else if (sawLetter) {
      break; // reached the row digits
    }
  }
  return index > 0 ? index - 1 : 0;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const doc = parseXml(xml);
  const rows: string[][] = [];

  for (const rowEl of elements(doc, "row")) {
    const cells = new Map<number, string>();
    let maxCol = -1;

    for (const c of elements(rowEl, "c")) {
      const col = columnIndex(c.getAttribute("r") ?? "");
      const type = c.getAttribute("t");
      let value = "";

      if (type === "inlineStr") {
        value = elements(c, "t").map((t) => t.textContent ?? "").join("");
      } else {
        const v = elements(c, "v")[0];
        const raw = v?.textContent ?? "";
        if (type === "s") {
          const idx = Number.parseInt(raw, 10);
          value = Number.isInteger(idx) && idx >= 0 && idx < shared.length ? shared[idx] : "";
        } else {
          value = raw;
        }
      }

      cells.set(col, value.trim());
      if (col > maxCol) maxCol = col;
    }

    // Pad sparse rows so column positions stay aligned with the header.
    const row: string[] = [];
    for (let i = 0; i <= maxCol; i += 1) row.push(cells.get(i) ?? "");
    rows.push(row);
  }
  return rows;
}

/** Parse every sheet of an .xlsx. Throws if the bytes are not readable. */
export async function readXlsx(bytes: Uint8Array): Promise<XlsxSheet[]> {
  if (!looksLikeXlsx(bytes)) {
    throw new Error(
      "That looks like an old .xls file. Open it in Excel and save as .xlsx or .csv."
    );
  }

  const entries = await readZip(bytes);
  const decoder = new TextDecoder();
  const find = (path: string) =>
    entries.find((e) => e.name.toLowerCase() === path.toLowerCase());

  // Shared string table: most cell text lives here.
  const shared: string[] = [];
  const sharedFile = find("xl/sharedStrings.xml");
  if (sharedFile) {
    const doc = parseXml(decoder.decode(sharedFile.bytes));
    for (const si of elements(doc, "si")) {
      // Concatenate <t> runs so rich text ("Par" + "le-G") comes back whole.
      shared.push(elements(si, "t").map((t) => t.textContent ?? "").join(""));
    }
  }

  // Sheet name -> part path, via the workbook relationships.
  const relTargets = new Map<string, string>();
  const relsFile = find("xl/_rels/workbook.xml.rels");
  if (relsFile) {
    const doc = parseXml(decoder.decode(relsFile.bytes));
    for (const rel of elements(doc, "Relationship")) {
      const id = rel.getAttribute("Id");
      const target = rel.getAttribute("Target");
      if (id && target) relTargets.set(id, target);
    }
  }

  const workbookFile = find("xl/workbook.xml");
  if (!workbookFile) return [];

  const sheets: XlsxSheet[] = [];
  const workbook = parseXml(decoder.decode(workbookFile.bytes));
  let fallbackIndex = 0;

  for (const sheetEl of elements(workbook, "sheet")) {
    fallbackIndex += 1;
    const name = sheetEl.getAttribute("name") ?? `Sheet${fallbackIndex}`;
    const rid = attr(sheetEl, "id");
    let target = rid ? relTargets.get(rid) : undefined;

    let part: ZipEntry | undefined;
    if (target) {
      target = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      part = find(target.replace("xl/xl/", "xl/"));
    }
    // Some writers omit or mismatch rels — fall back to positional sheetN.xml.
    if (!part) part = find(`xl/worksheets/sheet${fallbackIndex}.xml`);
    if (!part) continue;

    sheets.push({ name, rows: parseSheet(decoder.decode(part.bytes), shared) });
  }
  return sheets;
}
