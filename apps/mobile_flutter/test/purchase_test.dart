import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:flutter_test/flutter_test.dart';

PurchaseRecord _purchase({required double total, required double paid}) {
  return PurchaseRecord(
    id: 'p1',
    supplierName: 'Acme',
    supplierPhone: '',
    reference: '',
    total: total,
    amountPaid: paid,
    paymentMethod: 'CASH',
    notes: '',
    purchaseDate: DateTime(2026, 1, 1),
    actorName: null,
    tombstone: false,
  );
}

void main() {
  group('PurchaseRecord.balanceDue', () {
    test('unpaid bill is fully due', () {
      expect(_purchase(total: 1000, paid: 0).balanceDue, 1000);
    });

    test('partial payment leaves the remainder', () {
      expect(_purchase(total: 1000, paid: 400).balanceDue, 600);
    });

    test('fully paid bill has no due and reads as settled', () {
      final p = _purchase(total: 1000, paid: 1000);
      expect(p.balanceDue, 0);
      expect(p.isSettled, isTrue);
    });

    test('overpayment never goes negative', () {
      expect(_purchase(total: 1000, paid: 1200).balanceDue, 0);
    });

    test('a bill with any outstanding amount is not settled', () {
      expect(_purchase(total: 1000, paid: 999).isSettled, isFalse);
    });
  });
}
