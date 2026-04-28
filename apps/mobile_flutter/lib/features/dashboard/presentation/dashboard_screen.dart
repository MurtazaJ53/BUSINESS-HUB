import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final inventoryRepository = ref.watch(inventoryRepositoryProvider);
    final salesRepository = ref.watch(salesRepositoryProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final overviewStream = inventoryRepository.watchDashboardOverview(
      includeCost: session?.canViewCost ?? false,
    );
    final lowStockStream = inventoryRepository.watchLowStockPreview();
    final recentSalesStream = salesRepository.watchRecentSales(limit: 6);

    return StreamBuilder<DashboardOverview>(
      stream: overviewStream,
      builder: (context, overviewSnapshot) {
        final overview = overviewSnapshot.data ?? DashboardOverview.empty();

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: <Widget>[
            MobileHeroBanner(
              eyebrow: 'Live operations',
              title: 'Shop pulse, ready in motion.',
              subtitle:
                  'Local SQLite opens this dashboard first, then Firestore sync fills in the latest shop activity behind it.',
              trailing: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  MobileTag(
                    label: '${overview.metrics.totalItems} catalog items',
                    icon: Icons.inventory_2_rounded,
                  ),
                  const SizedBox(height: 10),
                  MobileTag(
                    label: syncStatus == MobileSyncStatus.syncing
                        ? 'Syncing workspace'
                        : 'Workspace live',
                    icon: syncStatus == MobileSyncStatus.syncing
                        ? Icons.sync_rounded
                        : Icons.wifi_tethering_rounded,
                    accent: syncStatus == MobileSyncStatus.error
                        ? const Color(0xFFFB7185)
                        : const Color(0xFF38BDF8),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.02,
              children: <Widget>[
                MobileMetricCard(
                  label: 'Catalog',
                  value: '${overview.metrics.totalItems}',
                  caption: '${overview.metrics.totalStock} units on hand',
                  icon: Icons.grid_view_rounded,
                ),
                MobileMetricCard(
                  label: 'Today revenue',
                  value: formatCurrency(overview.todayRevenue),
                  caption: '${overview.todaySalesCount} sales today',
                  icon: Icons.trending_up_rounded,
                  accent: const Color(0xFF22C55E),
                ),
                MobileMetricCard(
                  label: 'Inventory value',
                  value: formatCurrency(overview.metrics.inventoryValue),
                  caption: '${overview.metrics.lowStock} low stock alerts',
                  icon: Icons.currency_rupee_rounded,
                ),
                MobileMetricCard(
                  label: 'Potential profit',
                  value: session?.canViewCost == true
                      ? formatCurrency(overview.metrics.potentialProfit)
                      : 'Locked',
                  caption: session?.canViewCost == true
                      ? 'Margin projection'
                      : 'Admin view required',
                  icon: Icons.insights_rounded,
                  accent: const Color(0xFFA78BFA),
                ),
              ],
            ),
            const SizedBox(height: 18),
            StreamBuilder<List<LowStockItem>>(
              stream: lowStockStream,
              builder: (context, lowStockSnapshot) {
                final lowStock =
                    lowStockSnapshot.data ?? const <LowStockItem>[];
                return MobilePanel(
                  title: 'Critical stock watch',
                  action: MobileTag(
                    label: '${overview.metrics.lowStock} open',
                    icon: Icons.warning_amber_rounded,
                    accent: const Color(0xFFFB7185),
                  ),
                  child: lowStock.isEmpty
                      ? MobileEmptyState(
                          icon: syncStatus == MobileSyncStatus.syncing
                              ? Icons.sync_rounded
                              : Icons.verified_rounded,
                          title: syncStatus == MobileSyncStatus.syncing
                              ? 'Syncing inventory now'
                              : 'Stock levels look stable',
                          body: syncStatus == MobileSyncStatus.syncing
                              ? 'Your workspace is still hydrating from Firestore. Low-stock alerts will appear here as soon as the first inventory batch lands.'
                              : 'No urgent stock alerts are active in the local mobile catalog.',
                        )
                      : Column(
                          children: lowStock
                              .map(
                                (item) => _DashboardRow(
                                  title: item.name,
                                  subtitle: item.size?.isNotEmpty == true
                                      ? '${item.category} | ${item.size}'
                                      : item.category,
                                  trailing: 'Stock ${item.stock}',
                                  accent: const Color(0xFFFB7185),
                                ),
                              )
                              .toList(growable: false),
                        ),
                );
              },
            ),
            const SizedBox(height: 18),
            StreamBuilder<List<RecentSaleSummary>>(
              stream: recentSalesStream,
              builder: (context, recentSalesSnapshot) {
                final sales =
                    recentSalesSnapshot.data ?? const <RecentSaleSummary>[];
                return MobilePanel(
                  title: 'Recent sales',
                  action: MobileTag(
                    label: '${sales.length} recent',
                    icon: Icons.shopping_bag_rounded,
                    accent: const Color(0xFF22C55E),
                  ),
                  child: sales.isEmpty
                      ? MobileEmptyState(
                          icon: syncStatus == MobileSyncStatus.syncing
                              ? Icons.hourglass_top_rounded
                              : Icons.receipt_long_rounded,
                          title: syncStatus == MobileSyncStatus.syncing
                              ? 'Sales are still landing'
                              : 'No sales synced yet',
                          body: syncStatus == MobileSyncStatus.syncing
                              ? 'Give the app a moment while recent sales are pulled into local storage.'
                              : 'Once sales are recorded or synced, this feed will show the latest receipts here.',
                        )
                      : Column(
                          children: sales
                              .map(
                                (sale) => _DashboardRow(
                                  title: formatCurrency(sale.total),
                                  subtitle:
                                      '${sale.customerName?.isNotEmpty == true ? sale.customerName : 'Walk-in customer'} | ${sale.date}',
                                  trailing: sale.paymentMode,
                                  accent: const Color(0xFF22C55E),
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
    );
  }
}

class _DashboardRow extends StatelessWidget {
  const _DashboardRow({
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.accent,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF0A1220),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: <Widget>[
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: accent,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.58),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              Text(
                trailing,
                style: theme.textTheme.labelLarge?.copyWith(
                  color: accent,
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
