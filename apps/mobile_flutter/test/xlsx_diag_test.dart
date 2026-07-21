import 'dart:io';

import 'package:excel/excel.dart';
import 'package:flutter_test/flutter_test.dart';

// Diagnostic only: surface WHY the `excel` package fails to decode a real file.
void main() {
  test('decode demo_import.xlsx and report the actual failure', () {
    final file = File(r'D:/business-hub/demo_import.xlsx');
    if (!file.existsSync()) {
      // ignore: avoid_print
      print('SKIP: demo_import.xlsx not found');
      return;
    }
    try {
      final excel = Excel.decodeBytes(file.readAsBytesSync());
      // ignore: avoid_print
      print('DECODED OK. sheets=${excel.tables.keys.toList()}');
      for (final name in excel.tables.keys) {
        final t = excel.tables[name]!;
        // ignore: avoid_print
        print('  [$name] rows=${t.rows.length} cols=${t.maxColumns}');
      }
    } catch (e, st) {
      // ignore: avoid_print
      print('DECODE FAILED: $e');
      // ignore: avoid_print
      print(st.toString().split('\n').take(8).join('\n'));
    }
  });
}
