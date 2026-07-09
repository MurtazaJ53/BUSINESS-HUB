import '../models/mobile_models.dart';

/// Pure, side-effect-free money math for the POS cart.
///
/// Keeping this in one tested place is deliberate: a POS ships money, so a
/// wrong sign or clamp must be caught by unit tests, not in production. Both
/// the POS screen and the checkout sheet read their figures from here so the
/// UI can never drift from the values recorded on the sale.
class CartPricing {
  const CartPricing._();

  /// Sum of line totals (price * qty) before any discount.
  static double subtotal(Iterable<PosCartItem> items) =>
      items.fold<double>(0, (sum, item) => sum + item.lineTotal);

  /// Resolve a discount input (fixed rupees or a percent) to an amount,
  /// never negative and never more than the subtotal.
  static double discountAmount({
    required double subtotal,
    required double value,
    required bool isPercent,
  }) {
    if (value <= 0 || subtotal <= 0) return 0;
    final amount = isPercent ? subtotal * (value / 100) : value;
    if (amount <= 0) return 0;
    return amount > subtotal ? subtotal : amount;
  }

  /// Net payable after discount.
  static double net({required double subtotal, required double discount}) {
    final n = subtotal - discount;
    return n > 0 ? n : 0;
  }

  /// Total tendered across all payment lines.
  static double paid(Iterable<PosPayment> payments) =>
      payments.fold<double>(0, (sum, p) => sum + p.amount);

  /// Balance still owed (credit / khata) — 0 if fully paid.
  static double due({required double net, required double paid}) {
    final d = net - paid;
    return d > 0.009 ? d : 0;
  }

  /// Change to return (cash overpayment) — 0 if not overpaid.
  static double change({required double net, required double paid}) {
    final c = paid - net;
    return c > 0.009 ? c : 0;
  }
}
