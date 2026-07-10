import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/mobile_models.dart';
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

/// Build an 80mm thermal-style receipt PDF for a sale.
Future<Uint8List> buildReceiptPdf(SaleRecordDetail detail, ShopInfo shop) async {
  final doc = pw.Document();
  final format = PdfPageFormat(
    80 * PdfPageFormat.mm,
    double.infinity,
    marginAll: 6 * PdfPageFormat.mm,
  );

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
            if (shop.tagline.isNotEmpty)
              pw.Center(
                child: pw.Text(shop.tagline, style: const pw.TextStyle(fontSize: 8)),
              ),
            if (shop.phone.isNotEmpty)
              pw.Center(
                child: pw.Text(shop.phone, style: const pw.TextStyle(fontSize: 8)),
              ),
            pw.SizedBox(height: 6),
            pw.Text('Date: ${detail.date}', style: const pw.TextStyle(fontSize: 8)),
            if ((detail.customerName ?? '').isNotEmpty)
              pw.Text(
                'Customer: ${detail.customerName}',
                style: const pw.TextStyle(fontSize: 8),
              ),
            pw.Divider(),
            for (final it in detail.items)
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.stretch,
                children: <pw.Widget>[
                  pw.Text(it.name, style: const pw.TextStyle(fontSize: 9)),
                  pw.Row(
                    mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                    children: <pw.Widget>[
                      pw.Text(
                        '${it.quantity} x ${_money(it.unitPrice)}',
                        style: const pw.TextStyle(fontSize: 8),
                      ),
                      pw.Text(
                        _money(it.unitPrice * it.quantity),
                        style: const pw.TextStyle(fontSize: 8),
                      ),
                    ],
                  ),
                ],
              ),
            pw.Divider(),
            _row('Subtotal', _money(detail.subtotal)),
            if (detail.discount > 0) _row('Discount', '- ${_money(detail.discount)}'),
            _row('Total', _money(detail.total), bold: true),
            _row('Paid', _money(detail.amountReceived)),
            if (detail.amountDue > 0.009) _row('Balance due', _money(detail.amountDue)),
            pw.SizedBox(height: 10),
            if ((detail.footerNote ?? '').isNotEmpty)
              pw.Center(
                child: pw.Text(
                  detail.footerNote!,
                  textAlign: pw.TextAlign.center,
                  style: const pw.TextStyle(fontSize: 8),
                ),
              ),
            pw.SizedBox(height: 4),
            pw.Center(
              child: pw.Text(
                shop.footer,
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
