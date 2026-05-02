import '../models/mobile_models.dart';

class PaymentModeMixStats {
  const PaymentModeMixStats({
    required this.mode,
    required this.count,
    required this.grossAmount,
    required this.totalReceipts,
  });

  final String mode;
  final int count;
  final double grossAmount;
  final int totalReceipts;

  String get shareLabel {
    if (totalReceipts <= 0) {
      return '0% share';
    }
    final share = (count / totalReceipts) * 100;
    return '${share.toStringAsFixed(0)}% share';
  }
}

class HistoryReportSnapshot {
  const HistoryReportSnapshot({
    required this.receiptCount,
    required this.grossTotal,
    required this.collectedTotal,
    required this.dueTotal,
    required this.dueReceiptCount,
    required this.namedBuyerCount,
    required this.walkInCount,
    required this.averageTicketValue,
    required this.syncedCount,
    required this.queuedCount,
    required this.failedCount,
    required this.topPaymentMode,
    required this.paymentMix,
  });

  final int receiptCount;
  final double grossTotal;
  final double collectedTotal;
  final double dueTotal;
  final int dueReceiptCount;
  final int namedBuyerCount;
  final int walkInCount;
  final double averageTicketValue;
  final int syncedCount;
  final int queuedCount;
  final int failedCount;
  final String? topPaymentMode;
  final List<PaymentModeMixStats> paymentMix;

  factory HistoryReportSnapshot.fromSales(List<RecentSaleSummary> sales) {
    var grossTotal = 0.0;
    var collectedTotal = 0.0;
    var dueTotal = 0.0;
    var dueReceiptCount = 0;
    var namedBuyerCount = 0;
    var walkInCount = 0;
    var syncedCount = 0;
    var queuedCount = 0;
    var failedCount = 0;
    final paymentModeCounts = <String, int>{};
    final paymentModeAmounts = <String, double>{};

    for (final sale in sales) {
      grossTotal += sale.total;
      collectedTotal += sale.amountReceived;
      dueTotal += sale.amountDue;
      if ((sale.customerName ?? '').trim().isNotEmpty) {
        namedBuyerCount += 1;
      } else {
        walkInCount += 1;
      }
      if (sale.hasOutstandingDue) {
        dueReceiptCount += 1;
      }
      switch (sale.syncState) {
        case CommerceSyncState.synced:
          syncedCount += 1;
          break;
        case CommerceSyncState.queued:
          queuedCount += 1;
          break;
        case CommerceSyncState.failed:
          failedCount += 1;
          break;
        case CommerceSyncState.localOnly:
        case CommerceSyncState.syncing:
          break;
      }
      paymentModeCounts.update(
        sale.paymentMode,
        (value) => value + 1,
        ifAbsent: () => 1,
      );
      paymentModeAmounts.update(
        sale.paymentMode,
        (value) => value + sale.total,
        ifAbsent: () => sale.total,
      );
    }

    String? topPaymentMode;
    for (final entry in paymentModeCounts.entries) {
      if (topPaymentMode == null ||
          entry.value > (paymentModeCounts[topPaymentMode] ?? 0)) {
        topPaymentMode = entry.key;
      }
    }

    final paymentMix =
        paymentModeCounts.entries
            .map(
              (entry) => PaymentModeMixStats(
                mode: entry.key,
                count: entry.value,
                grossAmount: paymentModeAmounts[entry.key] ?? 0,
                totalReceipts: sales.length,
              ),
            )
            .toList(growable: false)
          ..sort((left, right) => right.count.compareTo(left.count));

    return HistoryReportSnapshot(
      receiptCount: sales.length,
      grossTotal: grossTotal,
      collectedTotal: collectedTotal,
      dueTotal: dueTotal,
      dueReceiptCount: dueReceiptCount,
      namedBuyerCount: namedBuyerCount,
      walkInCount: walkInCount,
      averageTicketValue: sales.isEmpty ? 0 : grossTotal / sales.length,
      syncedCount: syncedCount,
      queuedCount: queuedCount,
      failedCount: failedCount,
      topPaymentMode: topPaymentMode,
      paymentMix: paymentMix.take(4).toList(growable: false),
    );
  }
}

class BackendCustomerOperationalReport {
  const BackendCustomerOperationalReport({
    required this.visibleCount,
    required this.dueCount,
    required this.inactiveCount,
    required this.receivableBalance,
    required this.highestBalanceCustomer,
    required this.collectionsQueue,
  });

  final int visibleCount;
  final int dueCount;
  final int inactiveCount;
  final double receivableBalance;
  final BackendCustomerSummary? highestBalanceCustomer;
  final List<BackendCustomerSummary> collectionsQueue;

  factory BackendCustomerOperationalReport.fromCustomers(
    List<BackendCustomerSummary> customers,
  ) {
    var dueCount = 0;
    var inactiveCount = 0;
    var receivableBalance = 0.0;
    BackendCustomerSummary? highestBalanceCustomer;
    final dueCustomers = <BackendCustomerSummary>[];

    for (final customer in customers) {
      if (customer.balance > 0.009) {
        dueCount += 1;
        receivableBalance += customer.balance;
        dueCustomers.add(customer);
        if (highestBalanceCustomer == null ||
            customer.balance > highestBalanceCustomer.balance) {
          highestBalanceCustomer = customer;
        }
      }
      if (customer.status.toLowerCase() != 'active') {
        inactiveCount += 1;
      }
    }

    return BackendCustomerOperationalReport(
      visibleCount: customers.length,
      dueCount: dueCount,
      inactiveCount: inactiveCount,
      receivableBalance: receivableBalance,
      highestBalanceCustomer: highestBalanceCustomer,
      collectionsQueue:
          (dueCustomers
                ..sort((left, right) => right.balance.compareTo(left.balance)))
              .take(3)
              .toList(growable: false),
    );
  }
}

List<BackendCustomerSummary> sortBackendCustomers(
  List<BackendCustomerSummary> customers, {
  required String sortMode,
}) {
  final next = List<BackendCustomerSummary>.from(customers);
  next.sort((left, right) {
    return switch (sortMode) {
      'spent_desc' => right.totalSpent.compareTo(left.totalSpent),
      'name_asc' => left.name.toLowerCase().compareTo(right.name.toLowerCase()),
      _ => right.balance.compareTo(left.balance),
    };
  });
  return next;
}
