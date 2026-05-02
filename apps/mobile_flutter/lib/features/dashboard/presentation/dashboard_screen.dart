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
    final recentSalesStream = salesRepository.watchRecentSales(limit: 6);

    return StreamBuilder<DashboardOverview>(
      stream: overviewStream,
      builder: (context, overviewSnapshot) {
        final overview = overviewSnapshot.data ?? DashboardOverview.empty();
        final actionCards = <Widget>[
          MobileActionCard(
            kicker: 'POS HUB',
            title: 'Start sale',
            subtitle:
                'Open the native billing flow and move instantly into checkout.',
            icon: Icons.point_of_sale_rounded,
            accent: const Color(0xFF60A5FA),
            onTap: () => context.go('/pos'),
          ),
          MobileActionCard(
            kicker: 'CATALOG',
            title: 'Inventory',
            subtitle:
                'Browse products, stock signals, and filters without the web lag.',
            icon: Icons.inventory_2_rounded,
            accent: const Color(0xFF1D4ED8),
            onTap: () => context.go('/inventory'),
          ),
          MobileActionCard(
            kicker: 'CUSTOMERS',
            title: 'Customer desk',
            subtitle:
                'Pick up known buyers, recent repeat visits, and ledger posture fast.',
            icon: Icons.groups_rounded,
            accent: const Color(0xFF14B8A6),
            onTap: () => context.go('/customers'),
          ),
          MobileActionCard(
            kicker: 'HISTORY',
            title: 'Receipt feed',
            subtitle:
                'Check local queue health, synced receipts, and recent billing trails.',
            icon: Icons.receipt_long_rounded,
            accent: const Color(0xFFF59E0B),
            onTap: () => context.go('/history'),
          ),
        ];

        final metricCards = <Widget>[
          MobileMetricCard(
            label: 'Revenue',
            value: formatCurrency(overview.todayRevenue),
            caption: '${overview.todaySalesCount} sales today',
            icon: Icons.trending_up_rounded,
            accent: const Color(0xFF38BDF8),
          ),
          MobileMetricCard(
            label: 'Potential',
            value: session?.canViewCost == true
                ? formatCurrency(overview.metrics.potentialProfit)
                : 'Locked',
            caption: session?.canViewCost == true
                ? 'Margin projection'
                : 'Admin view required',
            icon: Icons.wallet_rounded,
            accent: const Color(0xFF22C55E),
          ),
          MobileMetricCard(
            label: 'Stock value',
            value: formatCurrency(overview.metrics.inventoryValue),
            caption: '${overview.metrics.totalItems} active SKUs',
            icon: Icons.inventory_2_rounded,
            accent: const Color(0xFF38BDF8),
          ),
          MobileMetricCard(
            label: 'Alerts',
            value: '${overview.metrics.lowStock}',
            caption: 'Restock required',
            icon: Icons.warning_amber_rounded,
            accent: const Color(0xFFFB7185),
          ),
        ];

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: <Widget>[
            MobileHeroBanner(
              eyebrow: 'Command center',
              title: 'Shop Command Center',
              subtitle:
                  'Real-time metrics, live sync status, and instant action cards tuned for a faster mobile Business Hub experience.',
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
                        ? 'Workspace syncing'
                        : 'Live link active',
                    icon: syncStatus == MobileSyncStatus.syncing
                        ? Icons.sync_rounded
                        : Icons.wifi_tethering_rounded,
                    accent: syncStatus == MobileSyncStatus.error
                        ? const Color(0xFFFB7185)
                        : const Color(0xFF22C55E),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            _ResponsiveGrid(minItemWidth: 170, children: actionCards),
            const SizedBox(height: 18),
            _ResponsiveGrid(minItemWidth: 155, children: metricCards),
            const SizedBox(height: 18),
            StreamBuilder<List<LowStockItem>>(
              stream: lowStockStream,
              builder: (context, lowStockSnapshot) {
                final lowStock =
                    lowStockSnapshot.data ?? const <LowStockItem>[];
                return MobilePanel(
                  title: 'Restock required',
                  action: MobileTag(
                    label: '${overview.metrics.lowStock} live',
                    icon: Icons.warning_amber_rounded,
                    accent: const Color(0xFFFB7185),
                  ),
                  child: lowStock.isEmpty
                      ? MobileEmptyState(
                          icon: syncStatus == MobileSyncStatus.syncing
                              ? Icons.sync_rounded
                              : Icons.verified_rounded,
                          title: syncStatus == MobileSyncStatus.syncing
                              ? 'Hydrating stock watch'
                              : 'No urgent stock alerts',
                          body: syncStatus == MobileSyncStatus.syncing
                              ? 'The mobile vault is still pulling inventory into local storage.'
                              : 'Current local inventory does not have any low-stock items.',
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
                  title: 'Recent sale feed',
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
                              : 'No synced sale feed yet',
                          body: syncStatus == MobileSyncStatus.syncing
                              ? 'Give the app a moment while recent sales finish syncing into local storage.'
                              : 'Once billing activity syncs, the latest receipts will appear here.',
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

class _ResponsiveGrid extends StatelessWidget {
  const _ResponsiveGrid({required this.minItemWidth, required this.children});

  final double minItemWidth;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final count = (constraints.maxWidth / minItemWidth).floor().clamp(1, 3);
        return GridView.count(
          crossAxisCount: count,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 0.96,
          children: children,
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
                width: 12,
                height: 12,
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
