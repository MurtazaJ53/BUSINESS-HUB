import 'package:business_hub_mobile/core/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('formatCurrency', () {
    test('formats small values with rupee symbol', () {
      expect(formatCurrency(99), '₹99');
    });

    test('formats thousands using Indian grouping', () {
      expect(formatCurrency(1234), '₹1,234');
      expect(formatCurrency(1234567), '₹12,34,567');
    });

    test('formats negative values', () {
      expect(formatCurrency(-8500), '-₹8,500');
    });
  });

  group('formatCompactDate', () {
    test('formats as dd/mm/yyyy', () {
      expect(
        formatCompactDate(DateTime(2026, 5, 2)),
        '02/05/2026',
      );
    });
  });
}
