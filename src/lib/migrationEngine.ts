import * as XLSX from 'xlsx';

// --- 1. Strict Type Definitions ---
export type MigrationType = 'inventory' | 'customer' | 'sale';

export interface MigrationResult {
  success: boolean;
  totalParsed: number;
  validItems: any[];
  errors: string[];
  type: MigrationType;
}

// --- 2. Hardened Data Sanitization Utilities ---
const sanitizeMoney = (val: unknown): number => {
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  if (!val) return 0;
  
  // Strip currency symbols and commas, preserve decimals and negatives
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
  // Extract the last 10 digits for Indian standard numbers, or return the whole string if shorter
  return digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly || '-';
};

// --- 3. Robust Date Parser ---
const extractDate = (val: unknown): string => {
  if (!val) return new Date().toISOString();
  
  // XLSX parsed it as a native JS Date (because we enabled cellDates)
  if (val instanceof Date) return val.toISOString();
  
  // String parsing fallback
  const parsed = new Date(String(val));
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
};

export const parseGenericExcel = async (file: File, type: MigrationType): Promise<MigrationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    const timer = setTimeout(() => {
      reader.abort();
      resolve({ 
        success: false, 
        totalParsed: 0, 
        validItems: [], 
        errors: ["MIGRATION_TIMEOUT: File took too long to read. Process aborted."], 
        type 
      });
    }, 15000); // 15s Safety Gate

    reader.onerror = () => {
      clearTimeout(timer);
      resolve({ success: false, totalParsed: 0, validItems: [], errors: ["OS denied file read access."], type });
    };

    reader.onabort = () => {
      clearTimeout(timer);
      // Already handled by the timeout resolve above, but good for completeness
    };

    reader.onload = (e) => {
      clearTimeout(timer);
      try {
        const data = e.target?.result;
        if (!data) throw new Error("Data stream interrupted.");

        // 🛑 CRITICAL FIX: cellDates must be true. Excel stores dates as integer days since 1900.
        // Without this, new Date(44210) resolves to January 1, 1970.
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        if (!workbook.SheetNames.length) throw new Error("Workbook contains no sheets.");
        
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawRows.length === 0) {
          resolve({ success: false, totalParsed: 0, validItems: [], errors: ["Sheet appears to be completely empty."], type });
          return;
        }

        const validItems = [];
        const errors = [];

        // --- 4. Extensible Mapping Engine ---
        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          const rowNum = i + 2; // +1 for 0-index, +1 for header row
          
          if (type === 'inventory') {
            const name = String(row['Item Name'] || row['Name'] || row['Product'] || '').trim();
            if (!name) { errors.push(`Row ${rowNum}: Bypassed (Missing Identity)`); continue; }
            
            validItems.push({
              name,
              price: sanitizeMoney(row['Sales Price'] || row['Price'] || row['Sell Price']),
              costPrice: sanitizeMoney(row['Purchase Price'] || row['Cost Price'] || row['Cost']),
              stock: sanitizeStock(row['Stock'] || row['Quantity'] || row['Qty']),
              category: String(row['Category'] || 'General').trim(),
              sku: String(row['Barcode'] || row['SKU'] || row['Item Code'] || '').trim(),
            });
            
          } else if (type === 'customer') {
            const name = String(row['Customer Name'] || row['Name'] || row['Customer'] || '').trim();
            if (!name) { errors.push(`Row ${rowNum}: Bypassed (Missing Name)`); continue; }
            
            validItems.push({
              name,
              phone: sanitizePhone(row['Phone'] || row['Contact'] || row['Mobile']),
              balance: sanitizeMoney(row['Balance'] || row['Credit'] || row['Udhaar']),
              totalSpent: sanitizeMoney(row['Total Spent'] || row['Sales'] || row['Revenue']),
            });
            
          } else if (type === 'sale') {
            const total = sanitizeMoney(row['Total'] || row['Amount'] || row['Grand Total']);
            if (total <= 0) { errors.push(`Row ${rowNum}: Bypassed (Zero or Missing Total)`); continue; }
            
            validItems.push({
              total,
              customerName: String(row['Customer'] || row['Customer Name'] || 'Walk-in Customer').trim(),
              createdAt: extractDate(row['Date'] || row['Created At'] || row['Timestamp']),
              items: [], // Simple legacy imports lack nested line-items
              payments: [{ mode: 'CASH', amount: total }],
            });
          }
        }

        resolve({ 
          success: true, 
          totalParsed: rawRows.length, 
          validItems, 
          errors, 
          type 
        });

      } catch (err: any) {
        console.error('[Migration Engine Fault]:', err);
        resolve({ 
          success: false, 
          totalParsed: 0, 
          validItems: [], 
          errors: [`Engine Failure: ${err.message}`], 
          type 
        });
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
};
