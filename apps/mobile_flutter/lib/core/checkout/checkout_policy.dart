import '../models/mobile_models.dart';

class CheckoutPaymentEntry {
  const CheckoutPaymentEntry({required this.mode, required this.amount});

  final String mode;
  final double amount;
}

class CheckoutPaymentResolution {
  const CheckoutPaymentResolution({
    required this.payments,
    required this.totalCollected,
  });

  final List<PosPayment> payments;
  final double totalCollected;

  double amountDueFor(double total) {
    final due = total - totalCollected;
    return due > 0 ? due : 0;
  }
}

CheckoutPaymentResolution? resolveCheckoutPayments({
  required String paymentMode,
  required double total,
  required double collectedAmount,
  required List<CheckoutPaymentEntry> splitPayments,
}) {
  if (paymentMode == 'SPLIT') {
    final payments = <PosPayment>[];
    var totalCollected = 0.0;
    for (final payment in splitPayments) {
      if (payment.amount <= 0) {
        return null;
      }
      payments.add(PosPayment(mode: payment.mode, amount: payment.amount));
      totalCollected += payment.amount;
    }
    if (payments.isEmpty || totalCollected > total + 0.009) {
      return null;
    }
    return CheckoutPaymentResolution(
      payments: payments,
      totalCollected: totalCollected,
    );
  }

  if (collectedAmount <= 0 || collectedAmount > total + 0.009) {
    return null;
  }

  return CheckoutPaymentResolution(
    payments: <PosPayment>[
      PosPayment(mode: paymentMode, amount: collectedAmount),
    ],
    totalCollected: collectedAmount,
  );
}

bool shouldConfirmCreditExposure({
  required double currentBalance,
  required double additionalDue,
}) {
  return currentBalance > 0.009 && additionalDue > 0;
}
