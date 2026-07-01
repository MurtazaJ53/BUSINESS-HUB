import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/premium_components.dart';

/// Redesigned Dashboard Screen v3.0
/// Simple, Clean, Premium, Professional
class DashboardScreenV3 extends ConsumerWidget {
  const DashboardScreenV3({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final syncStatus = ref.watch(syncStatusProvider);
    final shopAsync = ref.watch(shopInfoProvider);
    final overviewAsync = ref.watch(
      dashboardOverviewProvider(session?.canViewCost ?? false),
    );
    final historyAsync = ref.watch(historyOverviewProvider);
    final lowStockAsync = ref.watch(dashboardLowStockPreviewProvider);

    final shop = shopAsync.asData?.value ?? ShopInfo.fallback();
    final overview = overviewAsync.asData?.value ?? DashboardOverview.empty();
    final history = historyAsync.asData?.value ?? HistoryOverview.empty();
    final lowStock = lowStockAsync.asData?.value ?? const <LowStockItem>[];

    final isLoading = shopAsync.isLoading || overviewAsync.isLoading;
    final hasError = shopAsync.hasError || overviewAsync.hasError;

    return Scaffold(
      backgroundColor: AppColors.of(context).background,
      body: SafeArea(
        child: isLoading
            ? const Center(child: CircularProgressIndicator())
            : hasError
            ? _buildErrorState(context)
            : _buildContent(
                context,
                ref,
                session: session,
                shop: shop,
                overview: overview,
                history: history,
                lowStock: lowStock,
                syncStatus: syncStatus,
              ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context) {
    return EmptyStateWidget(
      icon: Icons.error_outline_rounded,
      title: 'Unable to load dashboard',
      message: 'Please check your connection and try again.',
      action: PrimaryActionButton(
        label: 'Retry',
        icon: Icons.refresh_rounded,
        onPressed: () {
          // Trigger refresh
        },
      ),
    );
  }

  Widget _buildContent(
    BuildContext context,
    WidgetRef ref, {
    required MobileSession? session,
    required ShopInfo shop,
    required DashboardOverview overview,
    required HistoryOverview history,
    required List<LowStockItem> lowStock,
    required MobileSyncStatus syncStatus,
  }) {
    return CustomScrollView(
      slivers: [
        // Header
        SliverToBoxAdapter(
          child: _buildHeader(
            context,
            shopName: shop.name,
            role: session?.displayRoleLabel ?? 'GUEST',
            syncStatus: syncStatus,
          ),
        ),

        // Hero Metric
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: HeroMetricCard(
              label: 'Today\'s Sales',
              value: formatCurrency(overview.todayRevenue),
              caption: '${overview.todaySalesCount} '
                  '${overview.todaySalesCount == 1 ? 'transaction' : 'transactions'}',
              // No fabricated trend: only show a delta once a real
              // period-over-period comparison is wired in.
              accentColor: AppPalette.success,
            ),
          ),
        ),

        // Primary Action
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
            child: PrimaryActionButton(
              label: 'Start New Sale',
              icon: Icons.point_of_sale_rounded,
              onPressed: () => context.go('/pos'),
            ),
          ),
        ),

        // Section: Quick Actions
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 32, 20, 16),
            child: SectionHeader(
              title: 'Quick Actions',
              action: StatusBadge(
                label: history.queuedSales > 0
                    ? '${history.queuedSales} queued'
                    : 'All synced',
                color: history.queuedSales > 0
                    ? AppPalette.warning
                    : AppPalette.success,
              ),
            ),
          ),
        ),

        // Quick Actions Grid
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverGrid(
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              childAspectRatio: 1.0,
            ),
            delegate: SliverChildListDelegate([
              QuickActionTile(
                label: 'Stock',
                subtitle: '${overview.metrics.totalItems} items',
                icon: Icons.inventory_2_rounded,
                accentColor: AppPalette.inventory,
                onTap: () => context.go('/inventory'),
              ),
              QuickActionTile(
                label: 'Customers',
                subtitle: '${history.totalSales} sales tracked',
                icon: Icons.groups_rounded,
                accentColor: AppPalette.customer,
                onTap: () => context.go('/customers'),
              ),
              QuickActionTile(
                label: 'History',
                subtitle: 'Recent sales',
                icon: Icons.receipt_long_rounded,
                accentColor: AppPalette.info,
                onTap: () => context.go('/history'),
              ),
              QuickActionTile(
                label: 'Reports',
                subtitle: 'Analytics',
                icon: Icons.analytics_rounded,
                accentColor: AppPalette.accent,
                onTap: () => context.push('/settings'),
              ),
            ]),
          ),
        ),

        // Section: Attention Needed
        if (lowStock.isNotEmpty) ...[
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 32, 20, 16),
              child: SectionHeader(
                title: 'Attention Needed',
                action: StatusBadge(
                  label: '${lowStock.length} items',
                  color: AppPalette.error,
                ),
              ),
            ),
          ),

          // Low Stock Items
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate((context, index) {
                final item = lowStock[index];
                return Padding(
                  padding: EdgeInsets.only(
                    bottom: index < lowStock.length - 1 ? 0 : 16,
                  ),
                  child: EnhancedListItem(
                    title: item.name,
                    subtitle: '${item.category} • Stock: ${item.stock}',
                    leadingIcon: Icons.warning_amber_rounded,
                    leadingColor: AppPalette.error,
                    onTap: () => context.go('/inventory'),
                  ),
                );
              }, childCount: lowStock.take(3).length),
            ),
          ),

          if (lowStock.length > 3)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
                child: TextButton(
                  onPressed: () => context.go('/inventory'),
                  child: Text('View all ${lowStock.length} items'),
                ),
              ),
            ),
        ],

        // Bottom spacing
        const SliverToBoxAdapter(child: SizedBox(height: 100)),
      ],
    );
  }

  Widget _buildHeader(
    BuildContext context, {
    required String shopName,
    required String role,
    required MobileSyncStatus syncStatus,
  }) {
    final theme = Theme.of(context);

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: Row(
        children: [
          // Shop info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  shopName,
                  style: theme.textTheme.titleLarge?.copyWith(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  role,
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.5,
                    color: AppColors.of(context).textTertiary,
                  ),
                ),
              ],
            ),
          ),
          // Sync status
          StatusBadge(
            label: syncStatus == MobileSyncStatus.syncing ? 'Syncing' : 'Live',
            color: syncStatus == MobileSyncStatus.error
                ? AppPalette.error
                : AppPalette.success,
          ),
          const SizedBox(width: 12),
          // Profile button
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppPalette.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: IconButton(
              icon: Icon(
                Icons.person_rounded,
                size: 20,
                color: AppPalette.primary,
              ),
              onPressed: () => context.push('/settings'),
              padding: EdgeInsets.zero,
            ),
          ),
        ],
      ),
    );
  }
}
