/**
 * Utility functions for exporting shop data to CSV and JSON formats.
 */

/**
 * Converts an array of objects to a CSV string.
 */
export function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const rows = data.map(obj => 
    headers.map(header => {
      let val = obj[header];
      if (val === undefined || val === null) return '';
      // Handle objects/arrays (like sale items) by stringifying them
      if (typeof val === 'object') val = JSON.stringify(val).replace(/"/g, '""');
      // Escape commas and quotes
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Triggers a browser download for a given string content.
 */
export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Specifically format sales data for a cleaner CSV report.
 */
export function exportSalesReport(sales: any[]) {
  const reportData = sales.map(s => ({
    Date: s.date,
    Invoice: s.id,
    Customer: s.customerName || 'Walk-in',
    Items: s.items.map((i: any) => `${i.name} (x${i.quantity})`).join('; '),
    Subtotal: s.total + s.discount,
    Discount: s.discount,
    Total: s.total,
    PaymentMode: s.paymentMode
  }));
  
  const csv = convertToCSV(reportData);
  downloadFile(csv, `Sales_Report_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

/**
 * GSTR-1 B2CS (B2C Small) Export Logic
 * Assumption: Standard 18% GST (inclusive) for retail
 */
export function generateGSTR1(sales: any[], shopGST: string) {
  const b2csData = sales.map(s => {
    const taxableValue = Number((s.total / 1.18).toFixed(2));
    const igst = 0;
    const cgst = Number(((s.total - taxableValue) / 2).toFixed(2));
    const sgst = cgst;

    return {
      "Type": "OE",
      "Place Of Supply": "Local", // Simple assumption
      "Applicable % of Tax Rate": "",
      "Rate": 18.0,
      "Taxable Value": taxableValue,
      "Cess Amount": 0,
      "E-Commerce GSTIN": ""
    };
  });

  const csv = convertToCSV(b2csData);
  downloadFile(csv, `GSTR1_B2CS_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}

/**
 * GSTR-3B Summary Export
 */
export function generateGSTR3B(sales: any[]) {
  const totalValue = sales.reduce((sum, s) => sum + s.total, 0);
  const taxableValue = Number((totalValue / 1.18).toFixed(2));
  const totalTax = Number((totalValue - taxableValue).toFixed(2));

  const summaryData = [{
    "Nature of Supplies": "(a) Outward taxable supplies (other than zero rated, nil rated and exempted)",
    "Total Taxable Value": taxableValue,
    "Integrated Tax": 0,
    "Central Tax": Number((totalTax / 2).toFixed(2)),
    "State/UT Tax": Number((totalTax / 2).toFixed(2)),
    "Cess": 0
  }];

  const csv = convertToCSV(summaryData);
  downloadFile(csv, `GSTR3B_Summary_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
}
