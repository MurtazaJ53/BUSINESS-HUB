import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

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
    final recentSalesStream = salesRepository.watchRecentSales(limit: 4);
    final historyStream = salesRepository.watchHistoryOverview();

    return StreamBuilder<DashboardOverview>(
      stream: overviewStream,
      builder: (context, overviewSnapshot) {
        final overview = overviewSnapshot.data ?? DashboardOverview.empty();
        return StreamBuilder<HistoryOverview>(
          stream: historyStream,
          builder: (context, historySnapshot) {
            final history = historySnapshot.data ?? HistoryOverview.empty();
            final quickActions = <Widget>[
              _QuickActionTile(
                icon: Icons.point_of_sale_rounded,
                title: 'New sale',
                subtitle: 'Open checkout',
                accent: const Color(0xFF60A5FA),
                onTap: () => context.go('/pos'),
              ),
              _QuickActionTile(
                icon: Icons.inventory_2_rounded,
                title: 'Stock',
                subtitle: 'Check inventory',
                accent: const Color(0xFF1D4ED8),
                onTap: () => context.go('/inventory'),
              ),
              _QuickActionTile(
                icon: Icons.groups_rounded,
                title: 'Customers',
                subtitle: 'Open buyer list',
                accent: const Color(0xFF14B8A6),
                onTap: () => context.go('/customers'),
              ),
              _QuickActionTile(
                icon: Icons.receipt_long_rounded,
                title: 'History',
                subtitle: 'View receipts',
                accent: const Color(0xFFF59E0B),
                onTap: () => context.go('/history'),
              ),
            ];

            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
              children: <Widget>[
                MobileScreenLead(
                  title: overview.todaySalesCount > 0
                      ? '${formatCurrency(overview.todayRevenue)} today'
                      : 'Ready to start today',
                  subtitle: overview.todaySalesCount > 0
                      ? '${overview.todaySalesCount} sale${overview.todaySalesCount == 1 ? '' : 's'} recorded so far. Everything important is below in one short view.'
                      : 'Start a sale, check stock, or follow queued receipts without moving through extra screens.',
                  icon: Icons.storefront_rounded,
                  accent: const Color(0xFF38BDF8),
                  primaryTag: MobileTag(
                    label: history.queuedSales > 0
                        ? '${history.queuedSales} queued'
                        : 'Queue clear',
                    icon: history.queuedSales > 0
                        ? Icons.cloud_upload_rounded
                        : Icons.check_circle_rounded,
                    accent: history.queuedSales > 0
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFF22C55E),
                  ),
                  secondaryTag: MobileTag(
                    label: syncStatus == MobileSyncStatus.syncing
                        ? 'Syncing'
                        : 'Live',
                    icon: syncStatus == MobileSyncStatus.syncing
                        ? Icons.sync_rounded
                        : Icons.wifi_tethering_rounded,
                    accent: syncStatus == MobileSyncStatus.error
                        ? const Color(0xFFFB7185)
                        : const Color(0xFF38BDF8),
                  ),
                ),
                const SizedBox(height: 18),
                MobilePanel(
                  title: 'Quick actions',
                  action: MobileTag(
                    label: 'DAILY USE',
                    icon: Icons.flash_on_rounded,
                    accent: const Color(0xFF38BDF8),
                  ),
                  child: LayoutBuilder(
                    builder: (context, constraints) {
                      final crossAxisCount = constraints.maxWidth < 420 ? 2 : 4;
                      return GridView.count(
                        crossAxisCount: crossAxisCount,
                        shrinkWrap: true,
                        physics: const NeverScrollableScrollPhysics(),
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 10,
                        childAspectRatio: constraints.maxWidth < 420 ? 1.02 : 1.1,
                        children: quickActions,
                      );
                    },
                  ),
                ),
                const SizedBox(height: 18),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final count = constraints.maxWidth > 520 ? 4 : 2;
                    return GridView.count(
                      crossAxisCount: count,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 1.02,
                      children: <Widget>[
                        MobileMetricCard(
                          label: 'Sales today',
                          value: '${overview.todaySalesCount}',
                          caption: 'Receipts created',
                          icon: Icons.shopping_bag_rounded,
                          accent: const Color(0xFF38BDF8),
                        ),
                        MobileMetricCard(
                          label: 'Revenue',
                          value: formatCurrency(overview.todayRevenue),
                          caption: 'Today total',
                          icon: Icons.currency_rupee_rounded,
                          accent: const Color(0xFF22C55E),
                        ),
                        MobileMetricCard(
                          label: 'Low stock',
                          value: '${overview.metrics.lowStock}',
                          caption: 'Needs refill',
                          icon: Icons.warning_amber_rounded,
                          accent: const Color(0xFFFB7185),
                        ),
                        MobileMetricCard(
                          label: 'Queue',
                          value: '${history.queuedSales}',
                          caption: history.queuedSales > 0
                              ? 'Pending upload'
                              : 'Everything sent',
                          icon: Icons.cloud_upload_rounded,
                          accent: history.queuedSales > 0
                              ? const Color(0xFFF59E0B)
                              : const Color(0xFF22C55E),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 18),
                StreamBuilder<List<LowStockItem>>(
                  stream: lowStockStream,
                  builder: (context, lowStockSnapshot) {
                    final lowStock =
                        lowStockSnapshot.data ?? const <LowStockItem>[];
                    return MobilePanel(
                      title: 'Needs attention',
                      action: MobileTag(
                        label: overview.metrics.lowStock > 0
                            ? '${overview.metrics.lowStock} low'
                            : 'Healthy',
                        icon: overview.metrics.lowStock > 0
                            ? Icons.warning_amber_rounded
                            : Icons.verified_rounded,
                        accent: overview.metrics.lowStock > 0
                            ? const Color(0xFFFB7185)
                            : const Color(0xFF22C55E),
                      ),
                      child: lowStock.isEmpty
                          ? MobileEmptyState(
                              icon: syncStatus == MobileSyncStatus.syncing
                                  ? Icons.sync_rounded
                                  : Icons.verified_rounded,
                              title: syncStatus == MobileSyncStatus.syncing
                                  ? 'Updating stock watch'
                                  : 'Nothing urgent right now',
                              body: syncStatus == MobileSyncStatus.syncing
                                  ? 'The app is still refreshing the local inventory watchlist.'
                                  : 'Stock alerts will appear here when an item drops too low.',
                            )
                          : Column(
                              children: lowStock
                                  .take(3)
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
                      title: 'Recent receipts',
                      action: MobileTag(
                        label: sales.isEmpty ? 'Waiting' : '${sales.length} recent',
                        icon: Icons.receipt_long_rounded,
                        accent: const Color(0xFFF59E0B),
                      ),
                      child: sales.isEmpty
                          ? MobileEmptyState(
                              icon: syncStatus == MobileSyncStatus.syncing
                                  ? Icons.hourglass_top_rounded
                                  : Icons.receipt_long_rounded,
                              title: syncStatus == MobileSyncStatus.syncing
                                  ? 'Pulling recent receipts'
                                  : 'No receipt feed yet',
                              body: syncStatus == MobileSyncStatus.syncing
                                  ? 'Recent sales are still syncing into local storage.'
                                  : 'Once billing starts, the latest receipts will show here.',
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
      },
    );
  }
}

class _QuickActionTile extends StatelessWidget {
  const _QuickActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.accent,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color accent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF0A1220),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: accent.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: accent, size: 20),
                ),
                const Spacer(),
                Text(
                  title,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.62),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
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
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: <Widget>[
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
              ),
              const SizedBox(width: 12),
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
              const SizedBox(width: 12),
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
