import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/tax/gst.dart';
import 'package:flutter_test/flutter_test.dart';

PosCartItem _item({
  double price = 100,
  double qty = 1,
  double gst = 0,
  bool incl = true,
}) => PosCartItem(
  id: 'i',
  name: 'x',
  price: price,
  quantity: qty,
  stock: 100,
  category: 'c',
  gstRate: gst,
  priceIncludesTax: incl,
);

void main() {
  test('no GST: taxable equals total, no tax', () {
    final s = computeCartGst([_item(price: 100, gst: 0)]);
    expect(s.taxableAmount, 100);
    expect(s.taxAmount, 0);
    expect(s.hasTax, isFalse);
  });

  test('tax-inclusive 18% splits the tax out of the price', () {
    final s = computeCartGst([_item(price: 118, gst: 18, incl: true)]);
    expect(s.taxableAmount, closeTo(100, 0.01));
    expect(s.taxAmount, closeTo(18, 0.01));
  });

  test('tax-exclusive 18% adds tax on top', () {
    final s = computeCartGst([_item(price: 100, gst: 18, incl: false)]);
    expect(s.taxableAmount, closeTo(100, 0.01));
    expect(s.taxAmount, closeTo(18, 0.01));
    expect(s.grossAmount, closeTo(118, 0.01));
  });

  test('intra-state splits into CGST + SGST', () {
    final s = computeCartGst([
      _item(price: 118, gst: 18, incl: true),
    ], intraState: true);
    expect(s.cgstAmount, closeTo(9, 0.01));
    expect(s.sgstAmount, closeTo(9, 0.01));
    expect(s.igstAmount, 0);
  });

  test('inter-state uses IGST', () {
    final s = computeCartGst([
      _item(price: 118, gst: 18, incl: true),
    ], intraState: false);
    expect(s.igstAmount, closeTo(18, 0.01));
    expect(s.cgstAmount, 0);
    expect(s.sgstAmount, 0);
  });

  test('discount reduces taxable + tax proportionally', () {
    final full = computeCartGst([_item(price: 118, gst: 18, incl: true)]);
    final discounted = computeCartGst([
      _item(price: 118, gst: 18, incl: true),
    ], discount: 59); // ~half off
    expect(discounted.taxableAmount, closeTo(full.taxableAmount / 2, 0.5));
    expect(discounted.taxAmount, closeTo(full.taxAmount / 2, 0.5));
  });
}
