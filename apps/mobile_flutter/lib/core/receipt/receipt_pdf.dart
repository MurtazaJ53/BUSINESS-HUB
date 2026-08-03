import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/mobile_models.dart';
import '../pos/upi_qr.dart';
import '../tax/gst.dart';
import '../utils/formatters.dart';

/// Rupee sign isn't in the base PDF font, so render amounts with "Rs ".
String _money(num value) => formatCurrency(value).replaceAll('₹', 'Rs ');

pw.Widget _row(String label, String value, {bool bold = false}) {
  final style = pw.TextStyle(
    fontSize: 9,
    fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
  );
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 1),
    child: pw.Row(
      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
      children: <pw.Widget>[
        pw.Text(label, style: style),
        pw.Text(value, style: style),
      ],
    ),
  );
}

pw.Widget _small(String text) =>
    pw.Text(text, style: const pw.TextStyle(fontSize: 8));

/// Build an 80mm receipt PDF. When the shop has a GSTIN it is rendered as a
/// GST **tax invoice** (per-item HSN + taxable + tax, and a CGST/SGST/IGST
/// summary); otherwise a plain receipt.
Future<Uint8List> buildReceiptPdf(SaleRecordDetail detail, ShopInfo shop) async {
  final doc = pw.Document();
  final format = PdfPageFormat(
    80 * PdfPageFormat.mm,
    double.infinity,
    marginAll: 6 * PdfPageFormat.mm,
  );

  final rawFooter = detail.footerNote ?? '';
  final buyerMatch =
      RegExp(r'Buyer GSTIN:\s*([0-9A-Za-z]+)').firstMatch(rawFooter);
  final buyerGstin = buyerMatch?.group(1);
  final footer =
      rawFooter.replaceAll(RegExp(r'\n*\s*Buyer GSTIN:.*'), '').trim();

  final isTaxInvoice = shop.hasGstin;
  // Same-state supply assumed (CGST+SGST). A cross-state IGST split would
  // compare the buyer/seller GSTIN state codes.
  const intraState = true;

  var taxable = 0.0;
  var cgst = 0.0;
  var sgst = 0.0;
  var totalTax = 0.0;
  for (final it in detail.items) {
    final line = computeLineGst(
      lineTotal: it.unitPrice * it.quantity,
      gstRate: it.gstRate,
      priceIncludesTax: it.priceIncludesTax,
      intraState: intraState,
    );
    taxable += line.taxableAmount;
    cgst += line.cgstAmount;
    sgst += line.sgstAmount;
    totalTax += line.taxAmount;
  }

  doc.addPage(
    pw.Page(
      pageFormat: format,
      build: (context) {
        return pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.stretch,
          children: <pw.Widget>[
            pw.Center(
              child: pw.Text(
                shop.name,
                style: pw.TextStyle(fontSize: 15, fontWeight: pw.FontWeight.bold),
              ),
            ),
            if (shop.tagline.isNotEmpty) pw.Center(child: _small(shop.tagline)),
            if (shop.phone.isNotEmpty) pw.Center(child: _small(shop.phone)),
            if (shop.hasGstin)
              pw.Center(child: _small('GSTIN: ${shop.gstin}')),
            pw.SizedBox(height: 6),
            pw.Center(
              child: pw.Text(
                isTaxInvoice ? 'TAX INVOICE' : 'RECEIPT',
                style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold),
              ),
            ),
            pw.SizedBox(height: 4),
            _small('Invoice: ${detail.id}'),
            _small('Date: ${detail.date}'),
            if ((detail.customerName ?? '').isNotEmpty)
              _small('Customer: ${detail.customerName}'),
            if (buyerGstin != null) _small('Buyer GSTIN: $buyerGstin'),
            pw.Divider(),
            for (final it in detail.items)
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                children: <pw.Widget>[
                  pw.Text(
                    it.name +
                        (isTaxInvoice &&
                                (it.hsnCode ?? '').isNotEmpty
                            ? '  (HSN ${it.hsnCode})'
                            : ''),
                    style: const pw.TextStyle(fontSize: 9),
                  ),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: <pw.Widget>[
                      pw.Text(
                        '${formatQty(it.quantity)} x ${_money(it.unitPrice)}'
                        '${isTaxInvoice && it.gstRate > 0 ? '  @${it.gstRate.toStringAsFixed(0)}%' : ''}',
                        style: const pw.TextStyle(fontSize: 8),
                      ),
                      pw.Text(
                        _money(it.unitPrice * it.quantity),
                        style: const pw.TextStyle(fontSize: 8),
                      ),
                    ],
                  ),
                  // Per-item discount, so the customer sees what came off this
                  // line rather than only a lump sum at the bottom.
                  if (it.lineDiscount > 0.009)
                    pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: <pw.Widget>[
                        pw.Text(
                          '  Item discount',
                          style: const pw.TextStyle(fontSize: 8),
                        ),
                        pw.Text(
                          '- ${_money(it.lineDiscount)}',
                          style: const pw.TextStyle(fontSize: 8),
                        ),
                      ],
                    ),
                ],
              ),
            pw.Divider(),
            if (isTaxInvoice) ...<pw.Widget>[
              _row('Taxable value', _money(taxable)),
              if (cgst > 0) _row('CGST', _money(cgst)),
              if (sgst > 0) _row('SGST', _money(sgst)),
              if (totalTax > 0) _row('Total GST', _money(totalTax)),
            ],
            if (detail.discount > 0) _row('Discount', '- ${_money(detail.discount)}'),
            _row('Total', _money(detail.total), bold: true),
            _row('Paid', _money(detail.amountReceived)),
            if (detail.amountDue > 0.009) _row('Balance due', _money(detail.amountDue)),
            pw.SizedBox(height: 10),
            // UPI pay QR so the customer can settle the balance from the PDF bill.
            if (receiptUpiUri(shopName: shop.name, amountDue: detail.amountDue) != null) ...<pw.Widget>[
              pw.Center(
                child: pw.Text(
                  'Scan to pay via UPI',
                  style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
                ),
              ),
              pw.SizedBox(height: 4),
              pw.Center(
                child: pw.BarcodeWidget(
                  barcode: pw.Barcode.qrCode(),
                  data: receiptUpiUri(
                    shopName: shop.name,
                    amountDue: detail.amountDue,
                  )!,
                  width: 96,
                  height: 96,
                  drawText: false,
                ),
              ),
              pw.SizedBox(height: 10),
            ],
            // Single footer line: the sale captured its footer message at sale
            // time (from Business Settings). Printing shop.footer again here
            // duplicated it and re-showed a message the user had since cleared.
            if (footer.isNotEmpty)
              pw.Center(
                child: pw.Text(
                  footer,
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ),
          ],
        );
      },
    ),
  );

  return doc.save();
}
