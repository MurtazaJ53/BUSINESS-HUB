import { Sale } from './types';
import { formatCurrency } from './utils';

/**
 * Universal Mobile Printing Service
 * Optimized for Thermal Printers (58mm/80mm) via Android Print Spooler or RawBT.
 */
export const printReceipt = (sale: Sale, shop: any) => {
  const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!printWindow) return false;

  const receiptHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt ${sale.id}</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 100%;
            max-width: 380px; /* Optimized for 80mm, scales for 58mm */
            margin: 0 auto;
            padding: 20px;
            color: #000;
            font-size: 14px;
            line-height: 1.2;
          }
          .header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px dashed #000;
          }
          .logo {
            font-weight: 900;
            font-size: 20px;
            letter-spacing: -1px;
            margin-bottom: 4px;
          }
          .shop-name {
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
          }
          .details {
            margin-bottom: 15px;
            font-size: 12px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .items {
            width: 100%;
            border-bottom: 1px dashed #000;
            margin-bottom: 10px;
            padding-bottom: 10px;
          }
          .item-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .totals {
            margin-top: 10px;
          }
          .total-big {
            font-size: 18px;
            font-weight: 900;
            border-top: 2px solid #000;
            margin-top: 5px;
            padding-top: 5px;
          }
          .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 11px;
            font-style: italic;
          }
          .qr-placeholder {
            margin: 10px 0;
            text-align: center;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">BH PRO</div>
          <div class="shop-name">${shop.name}</div>
          <div style="font-size: 10px;">${shop.address || ''}</div>
          <div style="font-size: 10px;">Ph: ${shop.phone || ''}</div>
        </div>

        <div class="details">
          <div class="row"><span>Order:</span> <span>#${sale.id.slice(-6)}</span></div>
          <div class="row"><span>Date:</span> <span>${new Date(sale.date).toLocaleDateString()}</span></div>
          <div class="row"><span>Time:</span> <span>${new Date(sale.createdAt).toLocaleTimeString()}</span></div>
          <div class="row"><span>Customer:</span> <span>${sale.customerName || 'Walk-in'}</span></div>
        </div>

        <div class="items">
          <div class="item-row" style="font-weight:bold; font-size: 10px; border-bottom: 1px solid #000; margin-bottom: 5px;">
            <span style="flex:2">Item</span>
            <span style="flex:1; text-align:center">Qty</span>
            <span style="flex:1; text-align:right">Price</span>
          </div>
          ${sale.items.map(item => `
            <div class="item-row">
              <span style="flex:2">${item.name}</span>
              <span style="flex:1; text-align:center">${item.quantity}</span>
              <span style="flex:1; text-align:right">${formatCurrency(item.price * item.quantity)}</span>
            </div>
          `).join('')}
        </div>

        <div class="totals">
          <div class="row"><span>Subtotal:</span> <span>${formatCurrency(sale.total + (sale.discount || 0))}</span></div>
          ${sale.discount ? `<div class="row"><span>Discount:</span> <span>-${formatCurrency(sale.discount)}</span></div>` : ''}
          <div class="row total-big"><span>TOTAL:</span> <span>${formatCurrency(sale.total)}</span></div>
          <div class="row" style="font-size:10px; margin-top: 5px;"><span>Paid via:</span> <span style="text-transform:uppercase;">${sale.paymentMode}</span></div>
        </div>

        <div class="footer">
          <p>Thank you for shopping with us!</p>
          <p>Software by Business Hub Pro</p>
        </div>

        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(receiptHtml);
  printWindow.document.close();
  return true;
};
