import 'package:business_hub_mobile/core/region/region.dart';
import 'package:business_hub_mobile/core/utils/formatters.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('default region', () {
    test('is India (primary market)', () {
      expect(activeRegion.region, AppRegion.india);
      expect(activeRegion.currencyCode, 'INR');
    });
  });

  group('formatCurrency (India / default)', () {
    test('formats with rupee symbol, no fraction, Indian grouping', () {
      expect(formatCurrency(99), '₹99');
      expect(formatCurrency(1234567), '₹12,34,567');
      expect(formatCurrency(-8500), '-₹8,500');
    });
  });

  group('formatCurrency (UK region)', () {
    test('formats with pound symbol, two-decimal pence, western grouping', () {
      expect(formatCurrency(99, region: ukRegion), '£99.00');
      expect(formatCurrency(12.5, region: ukRegion), '£12.50');
      expect(formatCurrency(1234567, region: ukRegion), '£1,234,567.00');
      expect(formatCurrency(-8500, region: ukRegion), '-£8,500.00');
    });
  });

  group('formatMinor', () {
    test('renders integer minor units per region', () {
      expect(formatMinor(1299, region: ukRegion), '£12.99');
      expect(formatMinor(100, region: ukRegion), '£1.00');
    });
  });

  group('tax helpers', () {
    test('VAT from a 20% gross amount', () {
      expect(taxFromGross(120, 0.20), closeTo(20, 0.0001));
      expect(netFromGross(120, 0.20), closeTo(100, 0.0001));
    });

    test('VAT added to a net amount', () {
      expect(taxFromNet(100, 0.20), closeTo(20, 0.0001));
    });
  });

  group('formatCompactDate', () {
    test('formats as dd/mm/yyyy', () {
      expect(formatCompactDate(DateTime(2026, 5, 2)), '02/05/2026');
    });
  });
}
