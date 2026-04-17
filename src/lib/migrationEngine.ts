import * as XLSX from 'xlsx';

export interface MigrationResult {
  success: boolean;
  totalParsed: number;
  validItems: Array<{
    name: string;
    price: number;
    costPrice: number;
    stock: number;
    category: string;
    sku: string;
    [key: string]: any;
  }>;
  errors: string[];
}

export const parseZobazeExcel = async (file: File): Promise<MigrationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error("File reading failed.");

        const workbook = XLSX.read(data, { type: 'binary' });
        // Assume first sheet is the inventory one
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to Array of Objects
        const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (rawRows.length === 0) {
          resolve({ success: false, totalParsed: 0, validItems: [], errors: ["Excel file appears to be empty."] });
          return;
        }

        const validItems = [];
        const errors = [];

        for (let i = 0; i < rawRows.length; i++) {
          const row = rawRows[i];
          
          // --- AI-Style Column Mapping ---
          
          // 1. Name Mapper
          const name = String(
            row['Item Name'] || row['Item Name '] || row['Name'] || row['Product'] || row['Product Name'] || ''
          ).trim();

          // 2. Pricing Mappers
          const parseMoney = (val: any) => {
            if (typeof val === 'number') return val;
            const parsed = parseFloat(String(val).replace(/[^0-9.-]+/g, ''));
            return isNaN(parsed) ? 0 : parsed;
          };

          const price = parseMoney(
            row['Sales Price'] || row['Sale Price'] || row['Price'] || row['Selling Price'] || 0
          );
          
          const costPrice = parseMoney(
            row['Purchase Price'] || row['Cost Price'] || row['Cost'] || 0
          );

          // 3. Stock Mapper
          const parseStock = (val: any) => {
            if (typeof val === 'number') return val;
            const parsed = parseFloat(String(val));
            return isNaN(parsed) ? 0 : parsed;
          };
          
          const stock = parseStock(
            row['Stock'] || row['Quantity'] || row['Qty'] || row['Available'] || 0
          );

          // 4. Metadata Mappers
          const category = String(
            row['Category'] || row['Department'] || row['Tag'] || 'General'
          ).trim();

          const sku = String(
            row['Barcode'] || row['SKU'] || row['Item Code'] || ''
          ).trim();

          // Validation
          if (!name) {
            errors.push(`Row ${i + 2}: Skipped due to missing item name.`);
            continue;
          }

          validItems.push({
            name,
            price,
            costPrice,
            stock,
            category,
            sku
          });
        }

        resolve({
          success: true,
          totalParsed: rawRows.length,
          validItems,
          errors
        });

      } catch (err: any) {
        resolve({
          success: false,
          totalParsed: 0,
          validItems: [],
          errors: [`Critical Parsing Error: ${err.message}`]
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        totalParsed: 0,
        validItems: [],
        errors: ["Failed to read the raw file."]
      });
    };

    // Read file as binary string to support Excel
    reader.readAsBinaryString(file);
  });
};
