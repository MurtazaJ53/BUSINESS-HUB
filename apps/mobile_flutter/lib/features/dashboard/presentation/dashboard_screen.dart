import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final inventoryRepository = ref.watch(inventoryRepositoryProvider);
    final salesRepository = ref.watch(salesRepositoryProvider);
    final overviewStream =
        inventoryRepository.watchDashboardOverview(includeCost: session?.canViewCost ?? false);
    final lowStockStream = inventoryRepository.watchLowStockPreview();
    final recentSalesStream = salesRepository.watchRecentSales(limit: 5);
    final syncStatus = ref.watch(syncStatusProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Dashboard')),
      body: StreamBuilder<DashboardOverview>(
        stream: overviewStream,
        builder: (context, overviewSnapshot) {
          final overview = overviewSnapshot.data ?? DashboardOverview.empty();
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                'Fast mobile dashboard',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                'Local SQLite opens first. Cloud sync hydrates in the background for a smoother Android feel.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 16),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: [
                      const Icon(Icons.sync_rounded),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Sync status: ${syncStatus.name.toUpperCase()}',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _MetricTile(
                    label: 'Catalog',
                    value: '${overview.metrics.totalItems}',
                  ),
                  _MetricTile(
                    label: 'Stock Units',
                    value: '${overview.metrics.totalStock}',
                  ),
                  _MetricTile(
                    label: 'Inventory Value',
                    value: formatCurrency(overview.metrics.inventoryValue),
                  ),
                  _MetricTile(
                    label: 'Today Revenue',
                    value: formatCurrency(overview.todayRevenue),
                  ),
                ],
              ),
              if (session?.canViewCost ?? false) ...[
                const SizedBox(height: 16),
                _InfoTile(
                  title: 'Potential profit',
                  body: formatCurrency(overview.metrics.potentialProfit),
                ),
              ],
              const SizedBox(height: 16),
              StreamBuilder<List<LowStockItem>>(
                stream: lowStockStream,
                builder: (context, lowStockSnapshot) {
                  final lowStock = lowStockSnapshot.data ?? const <LowStockItem>[];
                  return _SectionCard(
                    title: 'Low stock preview',
                    child: lowStock.isEmpty
                        ? const Text('Everything looks stable right now.')
                        : Column(
                            children: lowStock
                                .map(
                                  (item) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(item.name),
                                    subtitle: Text(item.category),
                                    trailing: Text('Stock ${item.stock}'),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                  );
                },
              ),
              const SizedBox(height: 16),
              StreamBuilder<List<RecentSaleSummary>>(
                stream: recentSalesStream,
                builder: (context, recentSalesSnapshot) {
                  final sales = recentSalesSnapshot.data ?? const <RecentSaleSummary>[];
                  return _SectionCard(
                    title: 'Recent sales',
                    child: sales.isEmpty
                        ? const Text('No local sales recorded yet on this Flutter app.')
                        : Column(
                            children: sales
                                .map(
                                  (sale) => ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(formatCurrency(sale.total)),
                                    subtitle: Text(
                                      '${sale.customerName?.isNotEmpty == true ? sale.customerName : 'Walk-in customer'} • ${sale.date}',
                                    ),
                                    trailing: Text(sale.paymentMode),
                                  ),
                                )
                                .toList(growable: false),
                          ),
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(body),
          ],
        ),
      ),
    );
  }
}

class _MetricTile extends StatelessWidget {
  const _MetricTile({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 160,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: 10),
              Text(
                value,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
  });

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}
