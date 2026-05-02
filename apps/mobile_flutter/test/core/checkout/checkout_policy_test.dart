import 'package:flutter_test/flutter_test.dart';

import 'package:business_hub_mobile/core/checkout/checkout_policy.dart';

void main() {
  group('resolveCheckoutPayments', () {
    test('accepts a standard single payment within total', () {
      final result = resolveCheckoutPayments(
        paymentMode: 'CASH',
        total: 1200,
        collectedAmount: 1200,
        splitPayments: const <CheckoutPaymentEntry>[],
      );

      expect(result, isNotNull);
      expect(result!.payments.length, 1);
      expect(result.payments.first.mode, 'CASH');
      expect(result.payments.first.amount, 1200);
      expect(result.totalCollected, 1200);
      expect(result.amountDueFor(1200), 0);
    });

    test('rejects single payment above total', () {
      final result = resolveCheckoutPayments(
        paymentMode: 'UPI',
        total: 900,
        collectedAmount: 950,
        splitPayments: const <CheckoutPaymentEntry>[],
      );

      expect(result, isNull);
    });

    test('accepts valid split payments and preserves due', () {
      final result = resolveCheckoutPayments(
        paymentMode: 'SPLIT',
        total: 1500,
        collectedAmount: 0,
        splitPayments: const <CheckoutPaymentEntry>[
          CheckoutPaymentEntry(mode: 'CASH', amount: 600),
          CheckoutPaymentEntry(mode: 'UPI', amount: 500),
        ],
      );

      expect(result, isNotNull);
      expect(result!.payments.length, 2);
      expect(result.totalCollected, 1100);
      expect(result.amountDueFor(1500), 400);
    });

    test('rejects split payments with non-positive line', () {
      final result = resolveCheckoutPayments(
        paymentMode: 'SPLIT',
        total: 1500,
        collectedAmount: 0,
        splitPayments: const <CheckoutPaymentEntry>[
          CheckoutPaymentEntry(mode: 'CASH', amount: 0),
          CheckoutPaymentEntry(mode: 'UPI', amount: 500),
        ],
      );

      expect(result, isNull);
    });

    test('rejects split payments above total', () {
      final result = resolveCheckoutPayments(
        paymentMode: 'SPLIT',
        total: 1500,
        collectedAmount: 0,
        splitPayments: const <CheckoutPaymentEntry>[
          CheckoutPaymentEntry(mode: 'CASH', amount: 900),
          CheckoutPaymentEntry(mode: 'UPI', amount: 700),
        ],
      );

      expect(result, isNull);
    });
  });

  group('shouldConfirmCreditExposure', () {
    test(
      'requires confirmation only when existing due and new due both exist',
      () {
        expect(
          shouldConfirmCreditExposure(currentBalance: 500, additionalDue: 200),
          isTrue,
        );
        expect(
          shouldConfirmCreditExposure(currentBalance: 0, additionalDue: 200),
          isFalse,
        );
        expect(
          shouldConfirmCreditExposure(currentBalance: 500, additionalDue: 0),
          isFalse,
        );
      },
    );
  });
}
