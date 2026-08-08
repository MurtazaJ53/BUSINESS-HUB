import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:flutter_test/flutter_test.dart';

ReportSale _sale(
  double total, {
  String? customer,
  List<ReportSaleLine> lines = const <ReportSaleLine>[],
}) {
  return ReportSale(total: total, customerName: customer, lines: lines);
}

void main() {
  group('computeProfitAndLoss', () {
    test('empty input yields zeros', () {
      final pl = computeProfitAndLoss(sales: const [], expenses: 0);
      expect(pl.grossSales, 0);
      expect(pl.netProfit, 0);
      expect(pl.topProducts, isEmpty);
    });

    test('Gross - COGS - Expenses = Net', () {
      final pl = computeProfitAndLoss(
        sales: <ReportSale>[
          _sale(
            1000,
            lines: <ReportSaleLine>[
              const ReportSaleLine(
                name: 'Widget',
                quantity: 10,
                price: 100,
                costPrice: 60,
              ),
            ],
          ),
        ],
        expenses: 150,
      );
      expect(pl.grossSales, 1000);
      expect(pl.cogs, 600); // 60 * 10
      expect(pl.grossProfit, 400);
      expect(pl.netProfit, 250); // 400 - 150
      expect(pl.marginPct, closeTo(40, 0.001));
    });

    test('GST collected: inclusive vs exclusive pricing', () {
      // Inclusive: 118 contains 18 GST on an 18% item.
      final inclusive = computeProfitAndLoss(
        sales: <ReportSale>[
          _sale(
            118,
            lines: <ReportSaleLine>[
              const ReportSaleLine(
                name: 'A',
                quantity: 1,
                price: 118,
                gstRate: 18,
                priceIncludesTax: true,
              ),
            ],
          ),
        ],
        expenses: 0,
      );
      expect(inclusive.gstCollected, closeTo(18, 0.001));

      // Exclusive: 100 + 18% = 18 GST.
      final exclusive = computeProfitAndLoss(
        sales: <ReportSale>[
          _sale(
            118,
            lines: <ReportSaleLine>[
              const ReportSaleLine(
                name: 'A',
                quantity: 1,
                price: 100,
                gstRate: 18,
                priceIncludesTax: false,
              ),
            ],
          ),
        ],
        expenses: 0,
      );
      expect(exclusive.gstCollected, closeTo(18, 0.001));
    });

    test('top products ranked by revenue, top customers by spend', () {
      final pl = computeProfitAndLoss(
        sales: <ReportSale>[
          _sale(
            300,
            customer: 'Asha',
            lines: <ReportSaleLine>[
              const ReportSaleLine(name: 'Pen', quantity: 3, price: 100),
            ],
          ),
          _sale(
            500,
            customer: 'Ravi',
            lines: <ReportSaleLine>[
              const ReportSaleLine(name: 'Book', quantity: 1, price: 500),
            ],
          ),
          _sale(
            100,
            customer: 'Asha',
            lines: <ReportSaleLine>[
              const ReportSaleLine(name: 'Pen', quantity: 1, price: 100),
            ],
          ),
        ],
        expenses: 0,
      );
      // Pen: 4 sold, 400 revenue; Book: 1 sold, 500 revenue -> Book first.
      expect(pl.topProducts.first.name, 'Book');
      expect(pl.topProducts[1].name, 'Pen');
      expect(pl.topProducts[1].quantity, 4);
      // Asha spend 400 (2 orders), Ravi 500 (1 order) -> Ravi first.
      expect(pl.topCustomers.first.name, 'Ravi');
      expect(pl.topCustomers[1].name, 'Asha');
      expect(pl.topCustomers[1].orders, 2);
    });
  });
}
