import 'package:business_hub_mobile/features/settings/presentation/settings_billing_screen.dart';
import 'package:flutter_test/flutter_test.dart';

/// Django REST Framework serialises DecimalField as a JSON *string*
/// ("500.00"), not a number. Casting it straight to num threw a TypeError and
/// every plan card on the billing screen rendered as "This screen hit a
/// runtime problem". These tests pin the exact shapes the API returns.
void main() {
  group('planMoney', () {
    test('parses a DRF decimal string', () {
      expect(planMoney('500.00'), 500.0);
      expect(planMoney('1450.00'), 1450.0);
      expect(planMoney('5500.00'), 5500.0);
    });

    test('still accepts a plain number', () {
      expect(planMoney(500), 500.0);
      expect(planMoney(2850.5), 2850.5);
    });

    test('never throws on null, junk or the wrong type', () {
      expect(planMoney(null), 0.0);
      expect(planMoney('not a number'), 0.0);
      expect(planMoney(''), 0.0);
      expect(planMoney(<String, dynamic>{}), 0.0);
    });

    test('tolerates surrounding whitespace', () {
      expect(planMoney(' 500.00 '), 500.0);
    });
  });

  group('planCount', () {
    test('parses ints and numeric strings', () {
      expect(planCount(30), 30);
      expect(planCount('3650'), 3650);
      expect(planCount(8), 8);
    });

    test('never throws on null or junk', () {
      expect(planCount(null), 0);
      expect(planCount('abc'), 0);
      expect(planCount(<int>[]), 0);
    });
  });
}
