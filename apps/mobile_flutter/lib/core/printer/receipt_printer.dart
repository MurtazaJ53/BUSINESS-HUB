import 'dart:typed_data';
import 'package:blue_thermal_printer/blue_thermal_printer.dart';
import 'package:esc_pos_utils_plus/esc_pos_utils_plus.dart';

import '../models/mobile_models.dart';
import '../tax/gst.dart';

class ReceiptPrinterService {
  final BlueThermalPrinter bluetooth = BlueThermalPrinter.instance;

  Future<List<BluetoothDevice>> getDevices() async {
    return await bluetooth.getBondedDevices();
  }

  Future<void> connect(BluetoothDevice device) async {
    await bluetooth.connect(device);
  }

  Future<void> disconnect() async {
    await bluetooth.disconnect();
  }

  Future<void> printTaxInvoice(SaleRecordDetail detail, ShopInfo shop) async {
    final bool? isConnected = await bluetooth.isConnected;
    if (isConnected != true) {
      throw Exception('Printer is not connected.');
    }

    final profile = await CapabilityProfile.load();
    final generator = Generator(PaperSize.mm58, profile);
    List<int> bytes = [];

    // Header
    final isB2b = detail.footerNote?.contains('Buyer GSTIN:') == true;
    bytes += generator.text(
      isB2b ? 'TAX INVOICE' : 'RECEIPT',
      styles: const PosStyles(
        align: PosAlign.center,
        height: PosTextSize.size2,
        width: PosTextSize.size2,
      ),
      linesAfter: 1,
    );

    bytes += generator.text(
      shop.name,
      styles: const PosStyles(align: PosAlign.center, bold: true),
    );
    // Removing unsupported ShopInfo address and stateCode
    bytes += generator.emptyLines(1);
    bytes += generator.text('Date: ${detail.date}');
    bytes += generator.text('Customer: ${detail.customerName?.isNotEmpty == true ? detail.customerName : 'Walk-in'}');
    
    // Parse buyer GSTIN from footerNote
    if (isB2b) {
      final parts = detail.footerNote!.split('Buyer GSTIN:');
      if (parts.length > 1) {
        final buyerGstin = parts[1].trim();
        bytes += generator.text('Buyer GSTIN: $buyerGstin');
      }
    }
    
    bytes += generator.emptyLines(1);

    // Items Header
    bytes += generator.row([
      PosColumn(text: 'Item', width: 6),
      PosColumn(text: 'Qty', width: 2),
      PosColumn(text: 'Total', width: 4, styles: const PosStyles(align: PosAlign.right)),
    ]);
    bytes += generator.hr();

    // Items
    for (final item in detail.items) {
      bytes += generator.row([
        PosColumn(text: item.name, width: 6),
        PosColumn(text: item.quantity.toString(), width: 2),
        PosColumn(text: item.lineTotal.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right)),
      ]);
      if (item.gstRate > 0) {
        bytes += generator.row([
          PosColumn(text: ' GST ${item.gstRate}%', width: 6, styles: const PosStyles(align: PosAlign.left)),
          PosColumn(text: '', width: 2),
          PosColumn(text: item.taxAmount.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right)),
        ]);
      }
    }
    bytes += generator.hr();

    // Totals
    // Totals
    var totalTaxable = 0.0;
    var totalCgst = 0.0;
    var totalSgst = 0.0;
    var totalIgst = 0.0;
    for (final item in detail.items) {
      totalTaxable += item.taxableAmount;
      totalCgst += item.cgstAmount;
      totalSgst += item.sgstAmount;
      totalIgst += item.igstAmount;
    }
    final hasTax = (totalCgst + totalSgst + totalIgst) > 0.009;
    
    bytes += generator.row([
      PosColumn(text: 'Subtotal:', width: 8, styles: const PosStyles(align: PosAlign.right)),
      PosColumn(text: detail.total.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right)),
    ]);
    
    if (hasTax) {
      bytes += generator.row([
        PosColumn(text: 'Taxable:', width: 8, styles: const PosStyles(align: PosAlign.right)),
        PosColumn(text: totalTaxable.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right)),
      ]);
      bytes += generator.row([
        PosColumn(text: 'CGST/SGST:', width: 8, styles: const PosStyles(align: PosAlign.right)),
        PosColumn(text: '${totalCgst.toStringAsFixed(2)}/${totalSgst.toStringAsFixed(2)}', width: 4, styles: const PosStyles(align: PosAlign.right)),
      ]);
      if (totalIgst > 0) {
        bytes += generator.row([
          PosColumn(text: 'IGST:', width: 8, styles: const PosStyles(align: PosAlign.right)),
          PosColumn(text: totalIgst.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right)),
        ]);
      }
    }

    bytes += generator.hr();
    bytes += generator.row([
      PosColumn(text: 'TOTAL DUE:', width: 8, styles: const PosStyles(align: PosAlign.right, bold: true)),
      PosColumn(text: detail.amountDue.toStringAsFixed(2), width: 4, styles: const PosStyles(align: PosAlign.right, bold: true)),
    ]);
    
    bytes += generator.emptyLines(1);
    bytes += generator.text(
      'Thank you for your business!',
      styles: const PosStyles(align: PosAlign.center),
    );
    bytes += generator.emptyLines(2);

    bluetooth.writeBytes(Uint8List.fromList(bytes));
  }
}
