import 'package:business_hub_mobile/core/money/money.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('rupees snap to whole paise', () {
    expect(Money.rupees(1.01).paise, 101);
    expect(Money.rupees(99.99).paise, 9999);
    expect(Money.rupees(0).paise, 0);
  });

  test('add / subtract / multiply are exact', () {
    // The classic 0.1 + 0.2 == 0.30000000000000004 double bug — fixed in paise.
    expect((Money.rupees(0.1) + Money.rupees(0.2)).rupees, 0.3);
    expect((Money(10000) - Money(3333)).paise, 6667);
    expect((Money.rupees(19.99) * 3).rupees, 59.97);
  });

  test('percent rounds to the nearest paise', () {
    expect(Money.rupees(200).percent(10), Money.rupees(20));
    expect(Money.rupees(118).percent(50).paise, 5900);
  });

  test('repeated additions do not drift', () {
    var running = Money.zero;
    for (var i = 0; i < 10; i++) {
      running = running + Money.rupees(0.1);
    }
    // A double accumulator would land on 0.9999999999999999 here.
    expect(running.rupees, 1.0);
  });

  test('clampedToZero and min', () {
    expect(const Money(-500).clampedToZero, Money.zero);
    expect(const Money(100).min(const Money(50)), const Money(50));
    expect(const Money(50).min(const Money(100)), const Money(50));
  });
}
