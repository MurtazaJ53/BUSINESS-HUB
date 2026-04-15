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
