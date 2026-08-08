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

/// The outcome of resolving cashier-entered tender lines into what is actually
/// *recorded* against the bill, plus the cash change to hand back.
class TenderResolution {
  const TenderResolution({
    required this.payments,
    required this.change,
    required this.overcharged,
  });

  /// Payments to store — never sum to more than the bill total.
  final List<PosPayment> payments;

  /// Cash surplus to return to the customer (display-only, never recorded).
  final double change;

  /// True if a non-cash line (CARD/UPI) exceeded the remaining balance — you
  /// cannot give change on a card, so the UI should block completion.
  final bool overcharged;

  double get totalCollected =>
      payments.fold<double>(0, (sum, p) => sum + p.amount);

  double dueFor(double total) {
    final due = total - totalCollected;
    return due > 0.009 ? due : 0;
  }
}

/// Turn the cashier's tender lines into recorded payments + change.
///
/// Rules that keep the books and the backend honest:
///  * Recorded payments can never exceed the bill total (the backend rejects
///    over-total payments), so cash over-tender becomes **change**, not money
///    collected — this is the fix for inflated drawer counts.
///  * Non-cash tenders (CARD/UPI) can't produce change; if one exceeds the
///    remaining balance it's flagged [overcharged] and capped so nothing bogus
///    is ever stored.
TenderResolution resolveCashierTender({
  required double total,
  required List<CheckoutPaymentEntry> lines,
}) {
  const eps = 0.009;
  var remaining = total;
  var overcharged = false;
  var cashTendered = 0.0;
  final recorded = <PosPayment>[];

  // Apply non-cash first — they must land exactly and can't create change.
  for (final line in lines) {
    if (line.amount <= 0) continue;
    if (line.mode == 'CASH') {
      cashTendered += line.amount;
      continue;
    }
    if (line.amount > remaining + eps) overcharged = true;
    final applied = line.amount > remaining ? remaining : line.amount;
    if (applied > eps) {
      recorded.add(PosPayment(mode: line.mode, amount: applied));
      remaining -= applied;
    }
  }

  // Cash fills whatever is left; the surplus is change.
  final cashApplied = cashTendered > remaining ? remaining : cashTendered;
  if (cashApplied > eps) {
    recorded.add(PosPayment(mode: 'CASH', amount: cashApplied));
    remaining -= cashApplied;
  }
  final change = cashTendered - cashApplied;

  return TenderResolution(
    payments: recorded,
    change: change > eps ? change : 0,
    overcharged: overcharged,
  );
}

/// Payment-mode label derived from the *recorded* payments.
String paymentModeFor(List<PosPayment> payments) {
  if (payments.isEmpty) return 'CREDIT';
  if (payments.length == 1) return payments.first.mode;
  return 'SPLIT';
}
