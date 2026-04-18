import * as XLSX from 'xlsx';

export interface MigrationResult {
  success: boolean;
  totalParsed: number;
  validItems: any[];
  errors: string[];
  type: 'inventory' | 'customer' | 'sale';
}

const parseMoney = (val: any) => {
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
  return isNaN(parsed) ? 0 : parsed;
};

const parseStock = (val: any) => {
  if (typeof val === 'number') return val;
  const parsed = parseFloat(String(val));
  return isNaN(parsed) ? 0 : parsed;
};

export const parseGenericExcel = async (file: File, type: 'inventory' | 'customer' | 'sale'): Promise<MigrationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("File reading failed.");

        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawRows.length === 0) {
          resolve({ success: false, totalParsed: 0, validItems: [], errors: ["Excel file appears to be empty."], type });
          return;
        }

        const validItems = [];
        const errors = [];

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          
          if (type === 'inventory') {
            const name = String(row['Item Name'] || row['Name'] || row['Product'] || '').trim();
            if (!name) { errors.push(`Row ${i + 2}: Missing name`); continue; }
            validItems.push({
              name,
              price: parseMoney(row['Sales Price'] || row['Price'] || 0),
              costPrice: parseMoney(row['Purchase Price'] || row['Cost Price'] || 0),
              stock: parseStock(row['Stock'] || row['Quantity'] || 0),
              category: String(row['Category'] || 'General').trim(),
              sku: String(row['Barcode'] || row['SKU'] || '').trim(),
            });
          } else if (type === 'customer') {
            const name = String(row['Customer Name'] || row['Name'] || row['Customer'] || '').trim();
            if (!name) { errors.push(`Row ${i + 2}: Missing customer name`); continue; }
            validItems.push({
              name,
              phone: String(row['Phone'] || row['Contact'] || row['Mobile'] || '').trim().replace(/[^0-9]/g, '').slice(-10),
              balance: parseMoney(row['Balance'] || row['Credit'] || row['Udhaar'] || 0),
              totalSpent: parseMoney(row['Total Spent'] || row['Sales'] || 0),
            });
          } else if (type === 'sale') {
            const total = parseMoney(row['Total'] || row['Amount'] || row['Grand Total'] || 0);
            if (total === 0) { errors.push(`Row ${i + 2}: Missing total amount`); continue; }
            validItems.push({
              total,
              customerName: String(row['Customer'] || row['Customer Name'] || 'Guest').trim(),
              createdAt: row['Date'] ? new Date(row['Date']).toISOString() : new Date().toISOString(),
              items: [], // Sales history import usually lacks item breakdown in simple CSVs
              payments: [{ mode: 'CASH', amount: total }],
            });
          }
        }

        resolve({ success: true, totalParsed: rawRows.length, validItems, errors, type });

      } catch (err: any) {
        resolve({ success: false, totalParsed: 0, validItems: [], errors: [`Critical Parsing Error: ${err.message}`], type });
      }
    };
    reader.readAsBinaryString(file);
  });
};
