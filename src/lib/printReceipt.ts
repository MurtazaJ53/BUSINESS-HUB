import type { Sale } from './types';

/**
 * Opens a new print window with a formatted thermal-style receipt.
 * Call this after a sale is recorded. The user can customize the
 * shop name / address by updating SHOP_INFO below.
 */

const SHOP_INFO = {
  name: 'Business Hub',
  tagline: 'Thank you for shopping with us!',
  address: '',        // e.g. "123 Main St, Mumbai"
  phone: '',          // e.g. "+91 98765 43210"
  gst: '',            // e.g. "GSTIN: 22AAAAA0000A1Z5"
  footer: 'Visit again! 😊',
};

export function printReceipt(sale: Sale) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit',
  });

  const invoiceNo = `INV-${sale.id.replace('sale-', '').slice(-6).toUpperCase()}`;

  const itemsHTML = sale.items
    .map(
      (item) => `
      <tr>
        <td class="item-name">${item.name}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-price">₹${item.price.toFixed(2)}</td>
        <td class="item-total">₹${(item.price * item.quantity).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const subtotal = sale.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt — ${invoiceNo}</title>
  <style>
    /* ── Reset ── */
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      color: #111;
      background: #fff;
      width: 80mm;          /* Standard 80mm thermal paper */
      max-width: 80mm;
      margin: 0 auto;
      padding: 8px 4px 20px;
    }

    /* ── Header ── */
    .header { text-align: center; margin-bottom: 10px; }
    .shop-name {
      font-size: 20px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .shop-tag { font-size: 11px; color: #444; margin-top: 2px; }
    .shop-meta { font-size: 11px; color: #333; margin-top: 3px; line-height: 1.5; }

    /* ── Dividers ── */
    .dashed { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    .solid  { border: none; border-top: 1px solid #000;  margin: 6px 0; }

    /* ── Invoice info ── */
    .info-row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .info-row .label { color: #555; }
    .info-row .value { font-weight: bold; }

    /* ── Items table ── */
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    thead th {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 3px 0;
      border-bottom: 1px solid #000;
    }
    th.item-name, td.item-name { text-align: left; width: 44%; }
    th.item-qty,  td.item-qty  { text-align: center; width: 12%; }
    th.item-price,td.item-price{ text-align: right; width: 20%; }
    th.item-total,td.item-total{ text-align: right; width: 24%; }

    tbody td {
      padding: 4px 0;
      vertical-align: top;
      font-size: 12px;
      border-bottom: 1px dashed #ddd;
    }

    /* ── Totals ── */
    .totals { margin-top: 6px; }
    .total-row { display: flex; justify-content: space-between; font-size: 12px; margin: 3px 0; }
    .total-row.grand {
      font-size: 16px;
      font-weight: bold;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 2px solid #000;
    }
    .total-row.discount { color: #c00; }
    .total-row.savings  { color: #080; font-size: 11px; }

    /* ── Payment badge ── */
    .payment-badge {
      text-align: center;
      margin: 10px 0 4px;
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      border: 1px solid #000;
      border-radius: 4px;
      padding: 2px 10px;
      font-weight: bold;
      font-size: 12px;
      letter-spacing: 1px;
    }

    /* ── Footer ── */
    .footer {
      text-align: center;
      margin-top: 12px;
      font-size: 11px;
      color: #444;
      line-height: 1.6;
    }
    .footer .thanks {
      font-size: 13px;
      font-weight: bold;
      color: #000;
    }

    /* ── Print-only: hide browser chrome, cut at page ── */
    @media print {
      html, body { width: 80mm; }
      @page {
        size: 80mm auto;
        margin: 0;
      }
    }
  </style>
</head>
<body>

  <!-- Shop Header -->
  <div class="header">
    <div class="shop-name">${SHOP_INFO.name}</div>
    ${SHOP_INFO.tagline ? `<div class="shop-tag">${SHOP_INFO.tagline}</div>` : ''}
    ${SHOP_INFO.address || SHOP_INFO.phone || SHOP_INFO.gst ? `
    <div class="shop-meta">
      ${SHOP_INFO.address ? SHOP_INFO.address + '<br/>' : ''}
      ${SHOP_INFO.phone ? 'Ph: ' + SHOP_INFO.phone + '<br/>' : ''}
      ${SHOP_INFO.gst ? SHOP_INFO.gst : ''}
    </div>` : ''}
  </div>

  <hr class="solid" />

  <!-- Invoice Info -->
  <div class="info-row"><span class="label">Invoice No</span><span class="value">${invoiceNo}</span></div>
  <div class="info-row"><span class="label">Date</span><span class="value">${dateStr}</span></div>
  <div class="info-row"><span class="label">Time</span><span class="value">${timeStr}</span></div>
  ${sale.customerName ? `<div class="info-row"><span class="label">Customer</span><span class="value">${sale.customerName}</span></div>` : ''}

  <hr class="dashed" />

  <!-- Items -->
  <table>
    <thead>
      <tr>
        <th class="item-name">Item</th>
        <th class="item-qty">Qty</th>
        <th class="item-price">Rate</th>
        <th class="item-total">Amt</th>
      </tr>
    </thead>
    <tbody>${itemsHTML}</tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="total-row">
      <span>Subtotal</span>
      <span>₹${subtotal.toFixed(2)}</span>
    </div>
    ${sale.discount > 0 ? `
    <div class="total-row discount">
      <span>Discount</span>
      <span>- ₹${sale.discount.toFixed(2)}</span>
    </div>
    <div class="total-row savings">
      <span>You saved</span>
      <span>₹${sale.discount.toFixed(2)}</span>
    </div>` : ''}
    <div class="total-row grand">
      <span>TOTAL</span>
      <span>₹${sale.total.toFixed(2)}</span>
    </div>
  </div>

  <!-- Payment mode -->
  <div class="payment-badge">
    Paid via &nbsp;<span class="badge">${sale.paymentMode}</span>
  </div>

  <hr class="dashed" />

  <!-- Footer -->
  <div class="footer">
    <div class="thanks">${SHOP_INFO.footer}</div>
    <div style="margin-top:6px; font-size:10px; color:#888;">
      ${sale.items.length} item${sale.items.length !== 1 ? 's' : ''} · ${now.toLocaleDateString('en-IN')}
    </div>
  </div>

  <script>
    // Auto-trigger print dialog when window opens
    window.onload = function() {
      window.print();
      // Close the window after print dialog closes (works in most browsers)
      window.onfocus = function() { window.close(); };
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
  if (!win) {
    alert('Pop-up blocked! Please allow pop-ups for this site to print receipts.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
