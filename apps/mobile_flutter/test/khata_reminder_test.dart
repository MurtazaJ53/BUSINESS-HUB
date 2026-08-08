import 'package:business_hub_mobile/core/khata/khata_reminder.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('buildKhataReminder', () {
    test('includes the balance and a pre-filled UPI pay link when owed', () {
      final msg = buildKhataReminder(
        shopName: 'Demo Mart',
        customerName: 'Rahul',
        balance: 249.5,
        upiVpa: 'demomart@okhdfcbank',
      );
      expect(msg, contains('Rahul'));
      expect(msg, contains('₹249.50'));
      expect(msg, contains('upi://pay?'));
      expect(msg, contains('am=249.50'));
      expect(msg, contains('pa=demomart%40okhdfcbank'));
    });

    test('no pay link when no VPA configured, but still reminds', () {
      final msg = buildKhataReminder(
        shopName: 'Demo Mart',
        customerName: 'Rahul',
        balance: 100,
      );
      expect(msg, contains('₹100.00'));
      expect(msg, isNot(contains('upi://')));
    });

    test('no pay link on a bad VPA (still sends the reminder)', () {
      final msg = buildKhataReminder(
        shopName: 'Demo Mart',
        customerName: 'Rahul',
        balance: 100,
        upiVpa: 'not-a-vpa',
      );
      expect(msg, contains('₹100.00'));
      expect(msg, isNot(contains('upi://')));
    });

    test('a settled customer gets a thank-you, no dues', () {
      final msg = buildKhataReminder(
        shopName: 'Demo Mart',
        customerName: 'Rahul',
        balance: 0,
      );
      expect(msg, contains('thank you'));
      expect(msg, isNot(contains('pending')));
    });
  });
}
