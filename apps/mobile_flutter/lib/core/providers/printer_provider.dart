import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../printer/receipt_printer.dart';

final receiptPrinterProvider = Provider<ReceiptPrinterService>((ref) {
  return ReceiptPrinterService();
});
