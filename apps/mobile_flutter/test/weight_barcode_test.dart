import 'package:business_hub_mobile/core/pos/weight_barcode.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('parseWeightBarcode (standard config)', () {
    test('decodes a price-embedded scale barcode', () {
      // 2 | 12345 | 001250 | 8  -> PLU 12345, price 12.50
      final b = parseWeightBarcode('2123450012508');
      expect(b, isNotNull);
      expect(b!.itemCode, '12345');
      expect(b.embeddedValue, closeTo(12.50, 0.001));
    });

    test('returns null for a normal (non-prefixed) barcode', () {
      expect(parseWeightBarcode('8901234567890'), isNull);
    });

    test('returns null for the wrong length', () {
      expect(parseWeightBarcode('212345001250'), isNull); // 12 digits
    });

    test('returns null for non-numeric input', () {
      expect(parseWeightBarcode('2ABCDE0012508'), isNull);
    });

    test('respects a custom config (rupees, not paise)', () {
      const config = WeightBarcodeConfig(valueDivisor: 1);
      final b = parseWeightBarcode('2123450012508', config: config);
      expect(b!.embeddedValue, closeTo(1250, 0.001));
    });
  });
}
