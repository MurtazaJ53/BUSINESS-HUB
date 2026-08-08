import 'package:flutter_test/flutter_test.dart';

import 'package:business_hub_mobile/core/insights/mobile_operational_insights.dart';
import 'package:business_hub_mobile/core/models/mobile_models.dart';

void main() {
  group('HistoryReportSnapshot', () {
    test('aggregates receipt, due, sync, and payment-mix metrics', () {
      final sales = <RecentSaleSummary>[
        const RecentSaleSummary(
          id: 'sale-1',
          total: 1200,
          amountReceived: 1000,
          amountDue: 200,
          date: '2026-05-01',
          paymentMode: 'CASH',
          syncState: CommerceSyncState.synced,
          customerName: 'Ayaan',
        ),
        const RecentSaleSummary(
          id: 'sale-2',
          total: 800,
          amountReceived: 800,
          amountDue: 0,
          date: '2026-05-01',
          paymentMode: 'UPI',
          syncState: CommerceSyncState.queued,
          customerName: null,
        ),
        const RecentSaleSummary(
          id: 'sale-3',
          total: 600,
          amountReceived: 300,
          amountDue: 300,
          date: '2026-05-02',
          paymentMode: 'CASH',
          syncState: CommerceSyncState.failed,
          customerName: 'Rida',
        ),
      ];

      final report = HistoryReportSnapshot.fromSales(sales);

      expect(report.receiptCount, 3);
      expect(report.grossTotal, 2600);
      expect(report.collectedTotal, 2100);
      expect(report.dueTotal, 500);
      expect(report.dueReceiptCount, 2);
      expect(report.namedBuyerCount, 2);
      expect(report.walkInCount, 1);
      expect(report.averageTicketValue, closeTo(866.67, 0.01));
      expect(report.syncedCount, 1);
      expect(report.queuedCount, 1);
      expect(report.failedCount, 1);
      expect(report.topPaymentMode, 'CASH');
      expect(report.paymentMix.first.mode, 'CASH');
      expect(report.paymentMix.first.count, 2);
      expect(report.paymentMix.first.grossAmount, 1800);
    });
  });

  group('BackendCustomerOperationalReport', () {
    const customers = <BackendCustomerSummary>[
      BackendCustomerSummary(
        id: 'c-1',
        name: 'Farah',
        totalSpent: 4000,
        balance: 900,
        status: 'active',
        phone: '9990001111',
      ),
      BackendCustomerSummary(
        id: 'c-2',
        name: 'Bilal',
        totalSpent: 12000,
        balance: 0,
        status: 'inactive',
      ),
      BackendCustomerSummary(
        id: 'c-3',
        name: 'Aarav',
        totalSpent: 8000,
        balance: 1500,
        status: 'active',
      ),
      BackendCustomerSummary(
        id: 'c-4',
        name: 'Diya',
        totalSpent: 2500,
        balance: 300,
        status: 'active',
      ),
    ];

    test('builds collections queue and receivable totals', () {
      final report = BackendCustomerOperationalReport.fromCustomers(customers);

      expect(report.visibleCount, 4);
      expect(report.dueCount, 3);
      expect(report.inactiveCount, 1);
      expect(report.receivableBalance, 2700);
      expect(report.highestBalanceCustomer?.name, 'Aarav');
      expect(report.collectionsQueue.map((customer) => customer.name), <String>[
        'Aarav',
        'Farah',
        'Diya',
      ]);
    });

    test('sorts customers by due, spend, and name modes', () {
      final dueOrder = sortBackendCustomers(customers, sortMode: 'due_desc');
      final spendOrder = sortBackendCustomers(
        customers,
        sortMode: 'spent_desc',
      );
      final nameOrder = sortBackendCustomers(customers, sortMode: 'name_asc');

      expect(dueOrder.first.name, 'Aarav');
      expect(spendOrder.first.name, 'Bilal');
      expect(nameOrder.map((customer) => customer.name).take(2), <String>[
        'Aarav',
        'Bilal',
      ]);
    });
  });
}
