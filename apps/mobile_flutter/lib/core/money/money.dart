/// Money as integer minor units (paise). All arithmetic is done in whole
/// paise so repeated add / discount / split operations can never drift the way
/// binary doubles do. Values are converted to/from rupees only at the edges
/// (UI + storage), where each amount is snapped to the nearest paise.
class Money {
  const Money(this.paise);

  /// Snap a rupee amount to the nearest paise.
  factory Money.rupees(num rupees) => Money((rupees * 100).round());

  static const Money zero = Money(0);

  final int paise;

  double get rupees => paise / 100.0;
  bool get isPositive => paise > 0;
  bool get isZero => paise == 0;

  Money operator +(Money other) => Money(paise + other.paise);
  Money operator -(Money other) => Money(paise - other.paise);
  Money operator *(int qty) => Money(paise * qty);

  /// A percentage of this amount, rounded to the nearest paise.
  Money percent(num pct) => Money((paise * pct / 100).round());

  /// Never below zero.
  Money get clampedToZero => paise < 0 ? Money.zero : this;

  /// The smaller of two amounts.
  Money min(Money other) => paise <= other.paise ? this : other;

  @override
  bool operator ==(Object other) => other is Money && other.paise == paise;

  @override
  int get hashCode => paise.hashCode;

  @override
  String toString() => 'Money(${rupees.toStringAsFixed(2)})';
}
