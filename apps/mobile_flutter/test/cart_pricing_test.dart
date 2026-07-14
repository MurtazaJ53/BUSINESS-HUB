import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/pos/cart_pricing.dart';
import 'package:flutter_test/flutter_test.dart';

PosCartItem _item({double price = 100, double qty = 1}) => PosCartItem(
  id: 'i',
  name: 'x',
  price: price,
  quantity: qty,
  stock: 100,
  category: 'c',
);

void main() {
  group('subtotal', () {
    test('sums line totals', () {
      expect(
        CartPricing.subtotal([_item(price: 100, qty: 2), _item(price: 50)]),
        250,
      );
    });
    test('empty cart is zero', () {
      expect(CartPricing.subtotal(const <PosCartItem>[]), 0);
    });
  });

  group('discountAmount', () {
    test('fixed rupees', () {
      expect(
        CartPricing.discountAmount(subtotal: 200, value: 50, isPercent: false),
        50,
      );
    });
    test('percent', () {
      expect(
        CartPricing.discountAmount(subtotal: 200, value: 10, isPercent: true),
        20,
      );
    });
    test('never exceeds subtotal', () {
      expect(
        CartPricing.discountAmount(subtotal: 100, value: 500, isPercent: false),
        100,
      );
    });
    test('negative is ignored', () {
      expect(
        CartPricing.discountAmount(subtotal: 100, value: -5, isPercent: false),
        0,
      );
    });
    test('zero subtotal yields zero', () {
      expect(
        CartPricing.discountAmount(subtotal: 0, value: 10, isPercent: true),
        0,
      );
    });
  });

  group('net', () {
    test('subtracts discount', () {
      expect(CartPricing.net(subtotal: 200, discount: 50), 150);
    });
    test('never negative', () {
      expect(CartPricing.net(subtotal: 50, discount: 100), 0);
    });
  });

  group('paid / due / change', () {
    test('paid sums payment lines', () {
      expect(
        CartPricing.paid(const [
          PosPayment(mode: 'CASH', amount: 40),
          PosPayment(mode: 'UPI', amount: 60),
        ]),
        100,
      );
    });
    test('due when underpaid (credit)', () {
      expect(CartPricing.due(net: 100, paid: 60), 40);
    });
    test('no due when paid in full', () {
      expect(CartPricing.due(net: 100, paid: 100), 0);
    });
    test('change when overpaid', () {
      expect(CartPricing.change(net: 100, paid: 130), 30);
    });
    test('no change on exact payment', () {
      expect(CartPricing.change(net: 100, paid: 100), 0);
    });
  });

  test('end-to-end: split payment with discount leaves correct due', () {
    final cart = [_item(price: 500, qty: 2)]; // 1000
    final subtotal = CartPricing.subtotal(cart);
    final discount = CartPricing.discountAmount(
      subtotal: subtotal,
      value: 10,
      isPercent: true,
    ); // 100
    final net = CartPricing.net(subtotal: subtotal, discount: discount); // 900
    final paid = CartPricing.paid(const [
      PosPayment(mode: 'CASH', amount: 400),
      PosPayment(mode: 'CARD', amount: 300),
    ]); // 700
    expect(net, 900);
    expect(CartPricing.due(net: net, paid: paid), 200);
    expect(CartPricing.change(net: net, paid: paid), 0);
  });
}
