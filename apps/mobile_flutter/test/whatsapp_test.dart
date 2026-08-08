import 'package:business_hub_mobile/core/util/whatsapp.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('normalizeWhatsAppNumber', () {
    test('adds India country code to a 10-digit number', () {
      expect(normalizeWhatsAppNumber('9876543210'), '919876543210');
    });

    test('strips a leading zero and adds country code', () {
      expect(normalizeWhatsAppNumber('09876543210'), '919876543210');
    });

    test('keeps a number that already has a country code', () {
      expect(normalizeWhatsAppNumber('919876543210'), '919876543210');
    });

    test('strips spaces, dashes and +', () {
      expect(normalizeWhatsAppNumber('+91 98765-43210'), '919876543210');
    });
  });
}
