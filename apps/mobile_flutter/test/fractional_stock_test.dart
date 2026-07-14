import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/pos/cart_pricing.dart';
import 'package:flutter_test/flutter_test.dart';

PosCartItem _line({required double price, required double qty}) => PosCartItem(
  id: 'i',
  name: 'Rice',
  price: price,
  quantity: qty,
  stock: 10,
  category: 'Grains',
);

void main() {
  group('fractional quantities', () {
    test('1.5 kg at Rs.60/kg -> line total Rs.90', () {
      final line = _line(price: 60, qty: 1.5);
      expect(line.lineTotal, 90);
      expect(CartPricing.subtotal(<PosCartItem>[line]), 90);
    });

    test('subtotal mixes whole + fractional lines exactly', () {
      final subtotal = CartPricing.subtotal(<PosCartItem>[
        _line(price: 60, qty: 1.5), // 90
        _line(price: 20, qty: 3), // 60
        _line(price: 33.33, qty: 0.25), // 8.33 (rounded to paise)
      ]);
      expect(subtotal, closeTo(158.33, 0.001));
    });

    test('P&L COGS uses fractional quantity', () {
      final pl = computeProfitAndLoss(
        sales: <ReportSale>[
          ReportSale(
            total: 90,
            lines: const <ReportSaleLine>[
              ReportSaleLine(
                name: 'Rice',
                quantity: 1.5,
                price: 60,
                costPrice: 40,
              ),
            ],
          ),
        ],
        expenses: 0,
      );
      expect(pl.grossSales, 90);
      expect(pl.cogs, 60); // 40 * 1.5
      expect(pl.grossProfit, 30);
      expect(pl.topProducts.first.quantity, 1.5);
    });

    test('low-stock threshold still works with fractional stock', () {
      final item = InventoryCatalogItem(
        id: 'i',
        name: 'Rice',
        price: 60,
        category: 'Grains',
        stock: 0.5,
        createdAt: DateTime(2026, 1, 1),
        reorderLevel: 2,
      );
      expect(item.isLowStock, isTrue); // 0.5 <= 2
    });
  });
}
