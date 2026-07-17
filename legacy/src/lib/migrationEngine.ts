import * as XLSX from 'xlsx';

export type MigrationType = 'inventory' | 'customer' | 'sale';

export interface MigrationResult {
  success: boolean;
  totalParsed: number;
  validItems: any[];
  errors: string[];
  warnings: string[];
  type: MigrationType;
  provider: 'generic' | 'zobaze';
  filesProcessed: number;
}

const sanitizeMoney = (val: unknown): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeStock = (val: unknown): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  const parsed = parseFloat(String(val));
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizePhone = (val: unknown): string => {
  if (!val) return '-';
  const digitsOnly = String(val).replace(/[^0-9]/g, '');
  return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly || '-';
};

const extractDate = (val: unknown): string => {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  const parsed = new Date(String(val));
  return !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

const normalizeDateOnly = (iso: string): string => {
  const parsed = new Date(iso);
  return !Number.isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
};

const coerceCell = (value: unknown): string => String(value ?? '').trim();
const isBlankRow = (row: Record<string, unknown>) => Object.values(row).every((value) => coerceCell(value) === '');

const slugify = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60);

const stableId = (prefix: string, ...parts: Array<string | number | null | undefined>): string => {
  const raw = parts.map((part) => String(part ?? '').trim().toLowerCase()).filter(Boolean).join('|');
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${slugify(raw) || 'record'}-${(hash >>> 0).toString(16)}`;
};

const normalizePaymentMode = (value: unknown): 'CASH' | 'UPI' | 'CARD' | 'CREDIT' | 'ONLINE' | 'OTHERS' => {
  const normalized = coerceCell(value).toLowerCase();
  if (normalized.includes('upi') || normalized.includes('bhim')) return 'UPI';
  if (normalized.includes('card')) return 'CARD';
  if (normalized.includes('credit')) return 'CREDIT';
  if (normalized.includes('online')) return 'ONLINE';
  if (normalized.includes('cash')) return 'CASH';
  return 'OTHERS';
};

const parseItemEntryName = (value: string): { productName: string; quantity: number; unitPrice: number | null } => {
  const match = value.match(/^(.*?)\s*\((\d+(?:\.\d+)?)\s*[xX]\s*([0-9.]+)\)\s*$/);
  if (!match) {
    return { productName: value.trim(), quantity: 1, unitPrice: null };
  }

  return {
    productName: match[1].trim(),
    quantity: Number(match[2]) || 1,
    unitPrice: Number(match[3]) || null,
  };
};

const isZobazeInventorySheet = (headers: string[]) => (
  ['CATEGORY', 'ITEM_TYPE', 'ITEM_NAME', 'VARIANT_NAME', 'PRICE', 'COST_PRICE', 'STOCK']
    .every((header) => headers.includes(header))
);

const isZobazeCustomerSheet = (headers: string[]) => (
  ['Name', 'Phone', 'AmountDue', 'AmountHeld (Advance)'].every((header) => headers.includes(header))
);

const isZobazeSalesWorkbook = (sheetNames: string[], headers: string[]) => (
  sheetNames.includes('receiptsWithItems') ||
  ['ReceiptId', 'Date', 'PaymentMode'].every((header) => headers.includes(header))
);

const parseZobazeInventoryRows = (rows: any[]) => {
  const validItems: any[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    if (isBlankRow(row)) return;

    const name = coerceCell(row.ITEM_NAME);
    if (!name) {
      errors.push(`Row ${index + 2}: Missing ITEM_NAME`);
      return;
    }

    const category = coerceCell(row.CATEGORY) || 'General';
    const itemType = coerceCell(row.ITEM_TYPE) || undefined;
    const variantName = coerceCell(row.VARIANT_NAME) || undefined;
    const rawSku = coerceCell(row.SKU) || '';
    const barcode = coerceCell(row.BARCODE) || '';

    validItems.push({
      id: stableId('zobaze-inv', name, variantName || '', rawSku || barcode || '', category),
      name,
      price: sanitizeMoney(row.PRICE),
      costPrice: sanitizeMoney(row.COST_PRICE),
      stock: sanitizeStock(row.STOCK),
      category,
      subcategory: itemType,
      size: variantName,
      sku: rawSku || barcode || undefined,
      createdAt: new Date().toISOString(),
      sourceMeta: {
        provider: 'zobaze',
        category,
        itemType: itemType || null,
        variantName: variantName || null,
        barcode: barcode || null,
        rawSku: rawSku || null,
      },
    });
  });

  return { validItems, errors, warnings: [] as string[] };
};

const parseZobazeCustomerRows = (rows: any[]) => {
  const validItems: any[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  rows.forEach((row, index) => {
    if (isBlankRow(row)) return;

    const name = coerceCell(row.Name);
    if (!name) {
      errors.push(`Row ${index + 2}: Missing customer name`);
      return;
    }

    const phone = sanitizePhone(row.Phone);
    const email = coerceCell(row.Email) || undefined;
    const amountDue = sanitizeMoney(row.AmountDue);
    const amountHeldAdvance = sanitizeMoney(row['AmountHeld (Advance)']);

    validItems.push({
      id: stableId('zobaze-cust', phone !== '-' ? phone : '', email || '', name),
      name,
      phone,
      email,
      totalSpent: 0,
      balance: Number((amountDue - amountHeldAdvance).toFixed(2)),
      createdAt: extractDate(row.AddedDate),
      sourceMeta: {
        provider: 'zobaze',
        address: coerceCell(row.Address) || null,
        gender: coerceCell(row.Gender) || null,
        numberOfOrders: Number(row.NumberOfOrders || 0) || 0,
        addedDate: row.AddedDate ? extractDate(row.AddedDate) : null,
        lastVisited: row.LastVisited ? extractDate(row.LastVisited) : null,
        amountDue,
        amountHeldAdvance,
      },
    });
  });

  warnings.push('Zobaze customer exports do not include lifetime spending, so total spent will be rebuilt from imported receipt history.');
  return { validItems, errors, warnings };
};

const parseZobazeSalesWorkbooks = (workbooks: Array<{ fileName: string; workbook: XLSX.WorkBook }>) => {
  const receipts = new Map<string, any>();
  let totalParsed = 0;

  for (const { fileName, workbook } of workbooks) {
    const detailSheetName = workbook.SheetNames.includes('receiptsWithItems')
      ? 'receiptsWithItems'
      : (workbook.SheetNames.includes('receipts') ? 'receipts' : workbook.SheetNames[0]);

    const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[detailSheetName], { defval: '' });
    for (const row of rows) {
      if (isBlankRow(row)) continue;

      const receiptId = coerceCell(row.ReceiptId);
      if (!receiptId) continue;
      totalParsed += 1;

      const receipt = receipts.get(receiptId) ?? {
        id: receiptId,
        items: [] as any[],
        payments: [] as any[],
        __itemSourceFile: null as string | null,
        total: 0,
        discount: 0,
        discountValue: '0',
        discountType: 'fixed',
        paymentMode: 'CASH',
        customerName: undefined,
        customerPhone: undefined,
        footerNote: '',
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        sourceMeta: {
          provider: 'zobaze',
          receiptId,
          cashier: null,
          customerEmail: null,
          subtotal: 0,
          totalTax: 0,
          deliveryCharges: 0,
          packingCharges: 0,
          serviceCharges: 0,
          customCharges: 0,
          sourceFiles: [] as string[],
        },
      };

      const entryType = coerceCell(row.EntryType);
      if (!entryType) {
        const createdAt = extractDate(row.Date);
        receipt.createdAt = createdAt;
        receipt.date = normalizeDateOnly(createdAt);
        receipt.total = sanitizeMoney(row.Total);
        receipt.discount = sanitizeMoney(row.Discount);
        receipt.discountValue = String(receipt.discount);
        receipt.paymentMode = normalizePaymentMode(row.PaymentMode);
        receipt.payments = [{ mode: receipt.paymentMode, amount: receipt.total }];
        receipt.customerName = coerceCell(row.CustomerName) || receipt.customerName;

        const customerPhone = sanitizePhone(row.CustomerNumber || row.CustomerPhone);
        receipt.customerPhone = customerPhone !== '-' ? customerPhone : receipt.customerPhone;

        receipt.footerNote = `Imported from Zobaze receipt ${receiptId}${coerceCell(row.Cashier) ? ` | Cashier: ${coerceCell(row.Cashier)}` : ''}`;
        receipt.sourceMeta = {
          ...receipt.sourceMeta,
          cashier: coerceCell(row.Cashier) || null,
          customerEmail: coerceCell(row.CustomerEmail) || null,
          subtotal: sanitizeMoney(row.Subtotal),
          totalTax: sanitizeMoney(row.TotalTax),
          deliveryCharges: sanitizeMoney(row.DeliveryCharges),
          packingCharges: sanitizeMoney(row.PackingCharges),
          serviceCharges: sanitizeMoney(row.ServiceCharges),
          customCharges: sanitizeMoney(row.CustomCharges),
          sourceFiles: Array.from(new Set([...(receipt.sourceMeta.sourceFiles || []), fileName])),
        };
      } else if (entryType.toLowerCase() === 'item') {
        if (receipt.__itemSourceFile && receipt.__itemSourceFile !== fileName) {
          receipts.set(receiptId, receipt);
          continue;
        }

        receipt.__itemSourceFile = fileName;
        const entryName = coerceCell(row.EntryName);
        const parsedEntry = parseItemEntryName(entryName);
        const lineAmount = sanitizeMoney(row.EntryAmount);
        const unitPrice = parsedEntry.unitPrice ?? (parsedEntry.quantity > 0 ? lineAmount / parsedEntry.quantity : lineAmount);

        receipt.items.push({
          itemId: stableId('zobaze-line', parsedEntry.productName),
          name: parsedEntry.productName,
          quantity: parsedEntry.quantity,
          price: Number(unitPrice.toFixed(2)),
        });
      }

      receipts.set(receiptId, receipt);
    }
  }

  return {
    validItems: Array.from(receipts.values()).map((receipt) => {
      const { __itemSourceFile, ...cleanReceipt } = receipt;
      return cleanReceipt;
    }).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    totalParsed,
    errors: [] as string[],
    warnings: [
      'Receipt imports are treated as historical sales, so current stock and current customer balance are preserved.',
      'For best customer linking, import Zobaze customers before importing monthly receipt files.',
    ],
  };
};

const parseGenericRows = (rows: any[], type: MigrationType): MigrationResult => {
  if (rows.length === 0) {
    return {
      success: false,
      totalParsed: 0,
      validItems: [],
      errors: ['Sheet appears to be completely empty.'],
      warnings: [],
      type,
      provider: 'generic',
      filesProcessed: 1,
    };
  }

  const validItems: any[] = [];
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    if (type === 'inventory') {
      const name = String(row['Item Name'] || row.Name || row.Product || '').trim();
      if (!name) {
        errors.push(`Row ${rowNum}: Bypassed (Missing Identity)`);
        continue;
      }

      validItems.push({
        id: stableId('generic-inv', name, row.SKU || row.Barcode || row['Item Code'] || ''),
        name,
        price: sanitizeMoney(row['Sales Price'] || row.Price || row['Sell Price']),
        costPrice: sanitizeMoney(row['Purchase Price'] || row['Cost Price'] || row.Cost),
        stock: sanitizeStock(row.Stock || row.Quantity || row.Qty),
        category: String(row.Category || 'General').trim(),
        sku: String(row.Barcode || row.SKU || row['Item Code'] || '').trim() || undefined,
      });
    } else if (type === 'customer') {
      const name = String(row['Customer Name'] || row.Name || row.Customer || '').trim();
      if (!name) {
        errors.push(`Row ${rowNum}: Bypassed (Missing Name)`);
        continue;
      }

      const phone = sanitizePhone(row.Phone || row.Contact || row.Mobile);
      validItems.push({
        id: stableId('generic-cust', phone !== '-' ? phone : '', row.Email || '', name),
        name,
        phone,
        email: row.Email || undefined,
        balance: sanitizeMoney(row.Balance || row.Credit || row.Udhaar),
        totalSpent: sanitizeMoney(row['Total Spent'] || row.Sales || row.Revenue),
        createdAt: new Date().toISOString(),
      });
    } else if (type === 'sale') {
      const total = sanitizeMoney(row.Total || row.Amount || row['Grand Total']);
      if (total <= 0) {
        errors.push(`Row ${rowNum}: Bypassed (Zero or Missing Total)`);
        continue;
      }

      const createdAt = extractDate(row.Date || row['Created At'] || row.Timestamp);
      validItems.push({
        id: stableId('generic-sale', createdAt, total, row.Customer || row['Customer Name'] || ''),
        total,
        discount: 0,
        discountValue: '0',
        discountType: 'fixed',
        paymentMode: 'CASH',
        customerName: String(row.Customer || row['Customer Name'] || 'Walk-in Customer').trim(),
        createdAt,
        date: normalizeDateOnly(createdAt),
        items: [],
        payments: [{ mode: 'CASH', amount: total }],
      });
    }
  }

  return {
    success: validItems.length > 0,
    totalParsed: rows.length,
    validItems,
    errors,
    warnings: [],
    type,
    provider: 'generic',
    filesProcessed: 1,
  };
};

export const parseImportFiles = async (files: File[], type: MigrationType): Promise<MigrationResult> => {
  try {
    if (!files.length) {
      return {
        success: false,
        totalParsed: 0,
        validItems: [],
        errors: ['No files selected.'],
        warnings: [],
        type,
        provider: 'generic',
        filesProcessed: 0,
      };
    }

    const workbooks = await Promise.all(files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      return {
        fileName: file.name,
        workbook: XLSX.read(buffer, { type: 'array', cellDates: true }),
      };
    }));

    const firstWorkbook = workbooks[0].workbook;
    if (!firstWorkbook.SheetNames.length) {
      return {
        success: false,
        totalParsed: 0,
        validItems: [],
        errors: ['Workbook contains no sheets.'],
        warnings: [],
        type,
        provider: 'generic',
        filesProcessed: files.length,
      };
    }

    const firstSheet = firstWorkbook.Sheets[firstWorkbook.SheetNames[0]];
    const firstRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
    const headers = Object.keys(firstRows[0] || {});

    if (type === 'inventory' && isZobazeInventorySheet(headers)) {
      const parsed = parseZobazeInventoryRows(firstRows);
      return {
        success: parsed.validItems.length > 0,
        totalParsed: firstRows.length,
        validItems: parsed.validItems,
        errors: parsed.errors,
        warnings: parsed.warnings,
        type,
        provider: 'zobaze',
        filesProcessed: files.length,
      };
    }

    if (type === 'customer' && isZobazeCustomerSheet(headers)) {
      const parsed = parseZobazeCustomerRows(firstRows);
      return {
        success: parsed.validItems.length > 0,
        totalParsed: firstRows.length,
        validItems: parsed.validItems,
        errors: parsed.errors,
        warnings: parsed.warnings,
        type,
        provider: 'zobaze',
        filesProcessed: files.length,
      };
    }

    if (type === 'sale' && isZobazeSalesWorkbook(firstWorkbook.SheetNames, headers)) {
      const parsed = parseZobazeSalesWorkbooks(workbooks);
      return {
        success: parsed.validItems.length > 0,
        totalParsed: parsed.totalParsed,
        validItems: parsed.validItems,
        errors: parsed.errors,
        warnings: parsed.warnings,
        type,
        provider: 'zobaze',
        filesProcessed: files.length,
      };
    }

    return parseGenericRows(firstRows, type);
  } catch (err: any) {
    console.error('[Migration Engine Fault]:', err);
    return {
      success: false,
      totalParsed: 0,
      validItems: [],
      errors: [`Engine Failure: ${err.message}`],
      warnings: [],
      type,
      provider: 'generic',
      filesProcessed: files.length,
    };
  }
};

export const parseGenericExcel = async (file: File, type: MigrationType): Promise<MigrationResult> => {
  return parseImportFiles([file], type);
};
