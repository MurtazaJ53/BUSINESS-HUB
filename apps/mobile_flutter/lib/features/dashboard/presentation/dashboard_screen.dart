import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final salesRepository = ref.read(salesRepositoryProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final shopAsync = ref.watch(shopInfoProvider);
    final overviewAsync = ref.watch(
      dashboardOverviewProvider(session?.canViewCost ?? false),
    );
    final historyAsync = ref.watch(historyOverviewProvider);
    final lowStockAsync = ref.watch(dashboardLowStockPreviewProvider);
    final salesAsync = ref.watch(dashboardRecentSalesProvider);
    final shop = shopAsync.asData?.value ?? ShopInfo.fallback();
    final overview = overviewAsync.asData?.value ?? DashboardOverview.empty();
    final history = historyAsync.asData?.value ?? HistoryOverview.empty();
    final lowStock = lowStockAsync.asData?.value ?? const <LowStockItem>[];
    final sales = salesAsync.asData?.value ?? const <RecentSaleSummary>[];
    final isCoreLoading =
        shopAsync.isLoading &&
        overviewAsync.isLoading &&
        historyAsync.isLoading &&
        lowStockAsync.isLoading &&
        salesAsync.isLoading;
    final hasCoreContent =
        shopAsync.hasValue ||
        overviewAsync.hasValue ||
        historyAsync.hasValue ||
        lowStockAsync.hasValue ||
        salesAsync.hasValue;
    final hasCoreError =
        shopAsync.hasError ||
        overviewAsync.hasError ||
        historyAsync.hasError ||
        lowStockAsync.hasError ||
        salesAsync.hasError;
    final roleProfile = _DashboardRoleProfile.fromSession(
      session: session,
      shop: shop,
      overview: overview,
      history: history,
    );
    final focus = _DashboardFocus.fromState(
      session: session,
      overview: overview,
      history: history,
      syncStatus: syncStatus,
      roleProfile: roleProfile,
    );
    final quickActions = <Widget>[
      _QuickActionTile(
        icon: Icons.point_of_sale_rounded,
        title: roleProfile.primaryActionTitle,
        subtitle: roleProfile.primaryActionSubtitle,
        accent: const Color(0xFF60A5FA),
        onTap: () => context.go('/pos'),
      ),
      _QuickActionTile(
        icon: Icons.inventory_2_rounded,
        title: 'Stock',
        subtitle: roleProfile.stockActionSubtitle,
        accent: const Color(0xFF1D4ED8),
        onTap: () => context.go('/inventory'),
      ),
      _QuickActionTile(
        icon: Icons.groups_rounded,
        title: 'Customers',
        subtitle: roleProfile.customerActionSubtitle,
        accent: const Color(0xFF14B8A6),
        onTap: () => context.go('/customers'),
      ),
      _QuickActionTile(
        icon: Icons.receipt_long_rounded,
        title: 'History',
        subtitle: roleProfile.historyActionSubtitle,
        accent: const Color(0xFFF59E0B),
        onTap: () => context.go('/history'),
      ),
      if (shop.supportsAttendance)
        _QuickActionTile(
          icon: Icons.fact_check_rounded,
          title: 'Attendance',
          subtitle: session?.isOwnerLike ?? false
              ? 'Review the floor and mark shifts'
              : 'Mark your day and review shifts',
          accent: const Color(0xFF14B8A6),
          onTap: () => context.push('/settings/attendance'),
        ),
    ];
    final metricCards = roleProfile.buildMetrics(
      overview: overview,
      history: history,
    );
    final displayedMetricCards =
        (session?.isOwnerLike ?? false) && !shop.supportsFinanceSummary
        ? <Widget>[
            MobileMetricCard(
              label: 'Sales today',
              value: '${overview.todaySalesCount}',
              caption: 'Receipts created',
              icon: Icons.shopping_bag_rounded,
              accent: const Color(0xFF38BDF8),
            ),
            MobileMetricCard(
              label: 'Low stock',
              value: '${overview.metrics.lowStock}',
              caption: overview.metrics.lowStock > 0
                  ? 'Needs refill'
                  : 'Healthy',
              icon: Icons.warning_amber_rounded,
              accent: overview.metrics.lowStock > 0
                  ? const Color(0xFFFB7185)
                  : const Color(0xFF22C55E),
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
            MobileMetricCard(
              label: 'Catalog',
              value: '${overview.metrics.totalItems}',
              caption: 'Products loaded',
              icon: Icons.inventory_2_rounded,
              accent: const Color(0xFFA78BFA),
            ),
          ]
        : metricCards;

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
      children: <Widget>[
        MobileScreenLead(
          title: roleProfile.leadTitle,
          subtitle: roleProfile.leadSubtitle,
          icon: roleProfile.leadIcon,
          accent: roleProfile.leadAccent,
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
            label: syncStatus == MobileSyncStatus.syncing ? 'Syncing' : 'Live',
            icon: syncStatus == MobileSyncStatus.syncing
                ? Icons.sync_rounded
                : Icons.wifi_tethering_rounded,
            accent: syncStatus == MobileSyncStatus.error
                ? const Color(0xFFFB7185)
                : const Color(0xFF38BDF8),
          ),
        ),
        const SizedBox(height: 18),
        MobileActionCard(
          kicker: focus.kicker,
          title: focus.title,
          subtitle: focus.subtitle,
          icon: focus.icon,
          accent: focus.accent,
          onTap: () => context.go(focus.route),
        ),
        const SizedBox(height: 18),
        if (isCoreLoading && !hasCoreContent) ...<Widget>[
          const _DashboardBootstrapPanel(),
          const SizedBox(height: 18),
        ] else if (hasCoreError && !hasCoreContent) ...<Widget>[
          const _DashboardUnavailablePanel(),
          const SizedBox(height: 18),
        ],
        if (session?.isOwnerLike ?? false) ...<Widget>[
          const _OwnerPulsePanel(),
          const SizedBox(height: 18),
        ],
        MobilePanel(
          title: roleProfile.quickActionsTitle,
          action: MobileTag(
            label: roleProfile.quickActionsTag,
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
              children: displayedMetricCards,
            );
          },
        ),
        const SizedBox(height: 18),
        if ((session?.isOwnerLike ?? false) &&
            !shop.supportsFinanceSummary) ...<Widget>[
          MobilePanel(
            title: 'Plan compare',
            action: MobileTag(
              label: '${shop.planLabel} now',
              icon: Icons.workspace_premium_rounded,
              accent: const Color(0xFFF59E0B),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                _DashboardPlanBlock(
                  title: _dashboardCurrentPlanTitle(shop),
                  lines: _dashboardCurrentPlanLines(shop),
                ),
                const SizedBox(height: 12),
                _DashboardPlanBlock(
                  title: _dashboardNextPlanTitle(shop),
                  lines: _dashboardNextPlanLines(shop),
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonalIcon(
                    onPressed: () => context.go('/settings'),
                    icon: const Icon(Icons.trending_up_rounded),
                    label: const Text('Open plan details'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
        ],
        MobilePanel(
          title: roleProfile.attentionTitle,
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
                      ? roleProfile.loadingAttentionTitle
                      : roleProfile.emptyAttentionTitle,
                  body: syncStatus == MobileSyncStatus.syncing
                      ? roleProfile.loadingAttentionBody
                      : roleProfile.emptyAttentionBody,
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
                          onTap: () => context.go('/inventory'),
                        ),
                      )
                      .toList(growable: false),
                ),
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: roleProfile.receiptsTitle,
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
                      : roleProfile.emptyReceiptsTitle,
                  body: syncStatus == MobileSyncStatus.syncing
                      ? 'Recent sales are still syncing into local storage.'
                      : roleProfile.emptyReceiptsBody,
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
                          onTap: () =>
                              _openSaleDetail(context, salesRepository, sale),
                        ),
                      )
                      .toList(growable: false),
                ),
        ),
      ],
    );
  }

  Future<void> _openSaleDetail(
    BuildContext context,
    SalesRepository salesRepository,
    RecentSaleSummary sale,
  ) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            child: FutureBuilder<SaleRecordDetail?>(
              future: salesRepository.getSaleDetail(sale.id),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const MobileEmptyState(
                    icon: Icons.sync_rounded,
                    title: 'Loading receipt detail',
                    body:
                        'The mobile vault is unpacking the full receipt payload for this sale.',
                  );
                }

                final detail = snapshot.data;
                if (detail == null) {
                  return const MobileEmptyState(
                    icon: Icons.receipt_long_outlined,
                    title: 'Receipt detail unavailable',
                    body:
                        'This receipt summary exists, but the full local payload could not be loaded.',
                  );
                }

                return ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 680),
                  child: ListView(
                    shrinkWrap: true,
                    children: <Widget>[
                      MobileSheetHeader(
                        eyebrow: 'Recent receipt',
                        title: formatCurrency(detail.total),
                        subtitle:
                            '${detail.customerName?.isNotEmpty == true ? detail.customerName : 'Walk-in customer'} | ${detail.date}',
                        icon: Icons.receipt_long_rounded,
                        accent: const Color(0xFFF59E0B),
                        tags: <Widget>[
                          MobileTag(
                            label: _syncLabel(detail.syncState),
                            icon: Icons.cloud_done_rounded,
                            accent: _syncTone(detail.syncState),
                          ),
                          MobileTag(
                            label: detail.paymentMode,
                            icon: Icons.payments_rounded,
                            accent: const Color(0xFF38BDF8),
                          ),
                          MobileTag(
                            label: '${detail.itemCount} items',
                            icon: Icons.shopping_bag_rounded,
                            accent: const Color(0xFFA78BFA),
                          ),
                          if (detail.hasOutstandingDue)
                            MobileTag(
                              label: 'Due ${formatCurrency(detail.amountDue)}',
                              icon: Icons.warning_amber_rounded,
                              accent: const Color(0xFFF59E0B),
                            ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _DashboardDetailSection(
                        title: 'Items',
                        child: Column(
                          children: detail.items
                              .map(
                                (item) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _DashboardSaleItemRow(item: item),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _DashboardDetailSection(
                        title: 'Payments',
                        child: Column(
                          children: detail.payments
                              .map(
                                (payment) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _DashboardSalePaymentRow(
                                    payment: payment,
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _DashboardDetailSection(
                        title: 'Summary',
                        child: Column(
                          children: <Widget>[
                            _DashboardSummaryRow(
                              label: 'Subtotal',
                              value: formatCurrency(detail.subtotal),
                            ),
                            _DashboardSummaryRow(
                              label: 'Discount',
                              value: formatCurrency(detail.discount),
                            ),
                            _DashboardSummaryRow(
                              label: 'Total',
                              value: formatCurrency(detail.total),
                              emphasize: true,
                            ),
                            _DashboardSummaryRow(
                              label: 'Collected',
                              value: formatCurrency(detail.amountReceived),
                            ),
                            _DashboardSummaryRow(
                              label: 'Due outstanding',
                              value: formatCurrency(detail.amountDue),
                              emphasize: detail.hasOutstandingDue,
                            ),
                            if ((detail.customerPhone ?? '').isNotEmpty)
                              _DashboardSummaryRow(
                                label: 'Phone',
                                value: detail.customerPhone!,
                              ),
                            if ((detail.footerNote ?? '').isNotEmpty)
                              _DashboardSummaryRow(
                                label: 'Footer note',
                                value: detail.footerNote!,
                              ),
                            if ((detail.commandId ?? '').isNotEmpty)
                              _DashboardSummaryRow(
                                label: 'Command',
                                value: detail.commandId!,
                              ),
                            if ((detail.lastSyncError ?? '').isNotEmpty)
                              _DashboardSummaryRow(
                                label: 'Last sync error',
                                value: detail.lastSyncError!,
                                emphasize: true,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }
}

class _DashboardBootstrapPanel extends StatelessWidget {
  const _DashboardBootstrapPanel();

  @override
  Widget build(BuildContext context) {
    return MobilePanel(
      title: 'Preparing Home',
      action: const MobileTag(
        label: 'LOADING',
        icon: Icons.sync_rounded,
        accent: Color(0xFF38BDF8),
      ),
      child: const MobileEmptyState(
        icon: Icons.dashboard_customize_rounded,
        title: 'Loading your workspace snapshot',
        body:
            'Business Hub is warming the local dashboard, stock watch, and recent receipt feed so Home opens with real data instead of a blank surface.',
      ),
    );
  }
}

class _DashboardUnavailablePanel extends StatelessWidget {
  const _DashboardUnavailablePanel();

  @override
  Widget build(BuildContext context) {
    return MobilePanel(
      title: 'Home needs attention',
      action: const MobileTag(
        label: 'CHECK DATA',
        icon: Icons.wifi_tethering_error_rounded,
        accent: Color(0xFFFB7185),
      ),
      child: const MobileEmptyState(
        icon: Icons.cloud_off_rounded,
        title: 'Dashboard data did not load cleanly',
        body:
            'The app kept Home visible instead of leaving a blank screen. Use refresh or open POS while the workspace retries its local and backend data.',
      ),
    );
  }
}

class _OwnerPulsePanel extends ConsumerWidget {
  const _OwnerPulsePanel();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pulseAsync = ref.watch(workspacePulseProvider);
    final pulse = pulseAsync.asData?.value;

    return MobilePanel(
      title: 'Workspace pulse',
      action: MobileTag(
        label: pulse == null
            ? (pulseAsync.isLoading ? 'Refreshing' : 'Unavailable')
            : pulse.stats.criticalAnomalyCount > 0
            ? '${pulse.stats.criticalAnomalyCount} critical'
            : '${pulse.stats.openTaskCount} tasks',
        icon: pulse == null
            ? Icons.sync_rounded
            : pulse.stats.criticalAnomalyCount > 0
            ? Icons.crisis_alert_rounded
            : Icons.auto_awesome_rounded,
        accent: pulse == null
            ? const Color(0xFF38BDF8)
            : pulse.stats.criticalAnomalyCount > 0
            ? const Color(0xFFFB7185)
            : const Color(0xFF38BDF8),
      ),
      child: pulse == null
          ? MobileEmptyState(
              icon: pulseAsync.isLoading
                  ? Icons.sync_rounded
                  : Icons.wifi_tethering_error_rounded,
              title: pulseAsync.isLoading
                  ? 'Refreshing workspace pulse'
                  : 'Pulse not available',
              body: pulseAsync.isLoading
                  ? 'Business Hub is generating owner/admin tasks and anomaly signals from the current workspace data.'
                  : 'Pulse needs a live backend check to show cross-workspace tasks and anomaly warnings.',
            )
          : Column(
              children: <Widget>[
                _DashboardRow(
                  title: pulse.headline.title,
                  subtitle: pulse.headline.body,
                  trailing: pulse.headline.ctaLabel,
                  accent: _pulseToneColor(pulse.headline.tone),
                  onTap: () =>
                      context.go(_resolvePulseRoute(pulse.headline.route)),
                ),
                ...pulse.tasks
                    .take(2)
                    .map(
                      (task) => _DashboardRow(
                        title: task.title,
                        subtitle: task.body,
                        trailing: task.priority.toUpperCase(),
                        accent: _pulseToneColor(task.tone),
                        onTap: () => context.go(_resolvePulseRoute(task.route)),
                      ),
                    ),
                if (pulse.anomalies.isNotEmpty)
                  _DashboardRow(
                    title: pulse.anomalies.first.title,
                    subtitle: pulse.anomalies.first.body,
                    trailing: pulse.anomalies.first.metricValue,
                    accent: _pulseSeverityColor(pulse.anomalies.first.severity),
                    onTap: () => context.go(
                      _resolvePulseRoute(pulse.anomalies.first.route),
                    ),
                  ),
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonalIcon(
                    onPressed: () => context.push('/settings/pulse'),
                    icon: const Icon(Icons.monitor_heart_rounded),
                    label: const Text('Open pulse desk'),
                  ),
                ),
              ],
            ),
    );
  }
}

class _DashboardRoleProfile {
  const _DashboardRoleProfile({
    required this.leadTitle,
    required this.leadSubtitle,
    required this.leadIcon,
    required this.leadAccent,
    required this.quickActionsTitle,
    required this.quickActionsTag,
    required this.primaryActionTitle,
    required this.primaryActionSubtitle,
    required this.stockActionSubtitle,
    required this.customerActionSubtitle,
    required this.historyActionSubtitle,
    required this.attentionTitle,
    required this.loadingAttentionTitle,
    required this.loadingAttentionBody,
    required this.emptyAttentionTitle,
    required this.emptyAttentionBody,
    required this.receiptsTitle,
    required this.emptyReceiptsTitle,
    required this.emptyReceiptsBody,
    required this.metricBlueprints,
  });

  final String leadTitle;
  final String leadSubtitle;
  final IconData leadIcon;
  final Color leadAccent;
  final String quickActionsTitle;
  final String quickActionsTag;
  final String primaryActionTitle;
  final String primaryActionSubtitle;
  final String stockActionSubtitle;
  final String customerActionSubtitle;
  final String historyActionSubtitle;
  final String attentionTitle;
  final String loadingAttentionTitle;
  final String loadingAttentionBody;
  final String emptyAttentionTitle;
  final String emptyAttentionBody;
  final String receiptsTitle;
  final String emptyReceiptsTitle;
  final String emptyReceiptsBody;
  final List<_MetricBlueprint> metricBlueprints;

  factory _DashboardRoleProfile.fromSession({
    required dynamic session,
    required ShopInfo shop,
    required DashboardOverview overview,
    required HistoryOverview history,
  }) {
    final receiptsToday = overview.todaySalesCount;
    final revenueToday = formatCurrency(overview.todayRevenue);

    if (session?.isCashierLike ?? false) {
      return _DashboardRoleProfile(
        leadTitle: receiptsToday > 0
            ? '$receiptsToday receipts this shift'
            : 'Ready for the next sale',
        leadSubtitle: history.queuedSales > 0
            ? 'Checkout is ready. Clear the queued receipts when the line is calm, then keep billing without leaving the floor flow.'
            : 'Open POS, scan products quickly, and keep the line moving. Your stock watch and recent receipts stay close by.',
        leadIcon: Icons.point_of_sale_rounded,
        leadAccent: const Color(0xFF38BDF8),
        quickActionsTitle: 'Shift shortcuts',
        quickActionsTag: 'FLOOR READY',
        primaryActionTitle: 'Open POS',
        primaryActionSubtitle: 'Start checkout',
        stockActionSubtitle: 'Check stock fast',
        customerActionSubtitle: 'Find buyer dues',
        historyActionSubtitle: 'Review receipts',
        attentionTitle: 'Floor watch',
        loadingAttentionTitle: 'Refreshing stock watch',
        loadingAttentionBody:
            'The app is updating the local stock watch before the next checkout cycle.',
        emptyAttentionTitle: 'Nothing urgent on the floor',
        emptyAttentionBody:
            'Low-stock warnings will land here when an item needs fast refill attention.',
        receiptsTitle: 'Recent checkout',
        emptyReceiptsTitle: 'No checkout feed yet',
        emptyReceiptsBody:
            'The latest billed receipts will appear here as soon as sales begin.',
        metricBlueprints: const <_MetricBlueprint>[
          _MetricBlueprint.salesToday(),
          _MetricBlueprint.queue(),
          _MetricBlueprint.syncedSales(),
          _MetricBlueprint.lowStock(),
        ],
      );
    }

    if (session?.isManager ?? false) {
      return _DashboardRoleProfile(
        leadTitle: receiptsToday > 0
            ? '$revenueToday on the floor'
            : 'Shift control is ready',
        leadSubtitle: receiptsToday > 0
            ? '$receiptsToday receipts have already landed. Watch low stock, queue pressure, and recent activity without digging through extra screens.'
            : 'Sales, stock pressure, and recent receipts stay grouped here so the day can start without dashboard clutter.',
        leadIcon: Icons.assessment_rounded,
        leadAccent: const Color(0xFF38BDF8),
        quickActionsTitle: 'Manager shortcuts',
        quickActionsTag: 'DAILY CONTROL',
        primaryActionTitle: 'New sale',
        primaryActionSubtitle: 'Jump to checkout',
        stockActionSubtitle: 'Check stock risk',
        customerActionSubtitle: 'Track collections',
        historyActionSubtitle: 'Open receipt feed',
        attentionTitle: 'Needs attention',
        loadingAttentionTitle: 'Refreshing attention list',
        loadingAttentionBody:
            'Stock risk and queue health are being refreshed from the local workspace.',
        emptyAttentionTitle: 'The shift looks calm',
        emptyAttentionBody:
            'Low-stock and operational exceptions will show here when they need manager attention.',
        receiptsTitle: 'Recent receipts',
        emptyReceiptsTitle: 'Receipt feed is still quiet',
        emptyReceiptsBody:
            'The latest billed activity will appear here as soon as sales begin.',
        metricBlueprints: const <_MetricBlueprint>[
          _MetricBlueprint.salesToday(),
          _MetricBlueprint.revenue(),
          _MetricBlueprint.lowStock(),
          _MetricBlueprint.queue(),
        ],
      );
    }

    return _DashboardRoleProfile(
      leadTitle: shop.supportsFinanceSummary
          ? (receiptsToday > 0 ? '$revenueToday today' : 'Store pulse ready')
          : (receiptsToday > 0
                ? '$receiptsToday receipt${receiptsToday == 1 ? '' : 's'} active'
                : 'Store pulse ready'),
      leadSubtitle: receiptsToday > 0
          ? '$receiptsToday sale${receiptsToday == 1 ? '' : 's'} are already recorded. Revenue, stock pressure, and receipt flow are grouped here in one owner-ready view.'
          : 'See today’s business pulse, stock pressure, and recent activity without opening dense management screens.',
      leadIcon: Icons.storefront_rounded,
      leadAccent: const Color(0xFF38BDF8),
      quickActionsTitle: 'Owner shortcuts',
      quickActionsTag: 'BUSINESS PULSE',
      primaryActionTitle: 'New sale',
      primaryActionSubtitle: 'Open checkout',
      stockActionSubtitle: 'Review stock health',
      customerActionSubtitle: 'Review customer balances',
      historyActionSubtitle: 'Open receipt feed',
      attentionTitle: 'Stock and queue watch',
      loadingAttentionTitle: 'Refreshing business watch',
      loadingAttentionBody:
          'The app is refreshing local stock pressure and queue posture for the owner view.',
      emptyAttentionTitle: 'Nothing urgent right now',
      emptyAttentionBody:
          'Low-stock pressure and operational exceptions will show here when they need owner attention.',
      receiptsTitle: 'Recent receipts',
      emptyReceiptsTitle: 'No receipt feed yet',
      emptyReceiptsBody:
          'Once billing starts, the latest receipts will show here for a quick owner check-in.',
      metricBlueprints: const <_MetricBlueprint>[
        _MetricBlueprint.revenue(),
        _MetricBlueprint.salesToday(),
        _MetricBlueprint.lowStock(),
        _MetricBlueprint.catalog(),
      ],
    );
  }

  List<Widget> buildMetrics({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) {
    return metricBlueprints
        .map(
          (blueprint) => MobileMetricCard(
            label: blueprint.label,
            value: blueprint.valueFor(overview: overview, history: history),
            caption: blueprint.captionFor(overview: overview, history: history),
            icon: blueprint.icon,
            accent: blueprint.accentFor(overview: overview, history: history),
          ),
        )
        .toList(growable: false);
  }
}

class _MetricBlueprint {
  const _MetricBlueprint({
    required this.label,
    required this.icon,
    required this.valueFor,
    required this.captionFor,
    required this.accentFor,
  });

  final String label;
  final IconData icon;
  final String Function({
    required DashboardOverview overview,
    required HistoryOverview history,
  })
  valueFor;
  final String Function({
    required DashboardOverview overview,
    required HistoryOverview history,
  })
  captionFor;
  final Color Function({
    required DashboardOverview overview,
    required HistoryOverview history,
  })
  accentFor;

  const _MetricBlueprint.salesToday()
    : this(
        label: 'Sales today',
        icon: Icons.shopping_bag_rounded,
        valueFor: _salesTodayValue,
        captionFor: _salesTodayCaption,
        accentFor: _salesTodayAccent,
      );

  const _MetricBlueprint.revenue()
    : this(
        label: 'Revenue',
        icon: Icons.currency_rupee_rounded,
        valueFor: _revenueValue,
        captionFor: _revenueCaption,
        accentFor: _revenueAccent,
      );

  const _MetricBlueprint.lowStock()
    : this(
        label: 'Low stock',
        icon: Icons.warning_amber_rounded,
        valueFor: _lowStockValue,
        captionFor: _lowStockCaption,
        accentFor: _lowStockAccent,
      );

  const _MetricBlueprint.queue()
    : this(
        label: 'Queue',
        icon: Icons.cloud_upload_rounded,
        valueFor: _queueValue,
        captionFor: _queueCaption,
        accentFor: _queueAccent,
      );

  const _MetricBlueprint.syncedSales()
    : this(
        label: 'Synced',
        icon: Icons.cloud_done_rounded,
        valueFor: _syncedSalesValue,
        captionFor: _syncedSalesCaption,
        accentFor: _syncedSalesAccent,
      );

  const _MetricBlueprint.catalog()
    : this(
        label: 'Catalog',
        icon: Icons.inventory_2_rounded,
        valueFor: _catalogValue,
        captionFor: _catalogCaption,
        accentFor: _catalogAccent,
      );

  static String _salesTodayValue({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => '${overview.todaySalesCount}';

  static String _salesTodayCaption({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => 'Receipts created';

  static Color _salesTodayAccent({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => const Color(0xFF38BDF8);

  static String _revenueValue({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => formatCurrency(overview.todayRevenue);

  static String _revenueCaption({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => 'Today total';

  static Color _revenueAccent({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => const Color(0xFF22C55E);

  static String _lowStockValue({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => '${overview.metrics.lowStock}';

  static String _lowStockCaption({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => overview.metrics.lowStock > 0 ? 'Needs refill' : 'Healthy';

  static Color _lowStockAccent({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => overview.metrics.lowStock > 0
      ? const Color(0xFFFB7185)
      : const Color(0xFF22C55E);

  static String _queueValue({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => '${history.queuedSales}';

  static String _queueCaption({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => history.queuedSales > 0 ? 'Pending upload' : 'Everything sent';

  static Color _queueAccent({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => history.queuedSales > 0
      ? const Color(0xFFF59E0B)
      : const Color(0xFF22C55E);

  static String _syncedSalesValue({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => '${history.syncedSales}';

  static String _syncedSalesCaption({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => history.syncedSales > 0 ? 'Uploaded cleanly' : 'Waiting for first sync';

  static Color _syncedSalesAccent({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => const Color(0xFF14B8A6);

  static String _catalogValue({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => '${overview.metrics.totalItems}';

  static String _catalogCaption({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => 'Products loaded';

  static Color _catalogAccent({
    required DashboardOverview overview,
    required HistoryOverview history,
  }) => const Color(0xFFA78BFA);
}

String _dashboardCurrentPlanTitle(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Starter now';
    case 'pro':
      return 'Pro now';
    default:
      return 'Growth now';
  }
}

List<String> _dashboardCurrentPlanLines(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return const <String>[
        'Selling, stock, customers, and receipts',
        'Lean owner view without extra operations clutter',
      ];
    case 'pro':
      return const <String>[
        'Finance and advanced reporting',
        'Stronger owner and support visibility',
      ];
    default:
      return const <String>[
        'Everything in Starter',
        'Expenses, attendance, and supplier-ready operations',
      ];
  }
}

String _dashboardNextPlanTitle(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Growth next';
    case 'pro':
      return 'Keep it curated';
    default:
      return 'Pro next';
  }
}

List<String> _dashboardNextPlanLines(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return const <String>[
        'Unlock expenses and attendance',
        'Add light supplier workflows',
      ];
    case 'pro':
      return const <String>[
        'Keep deep controls limited to owners and admins',
        'Leave daily work simple for staff',
      ];
    default:
      return const <String>[
        'Unlock finance and advanced reporting',
        'Add richer customer and sales insight',
      ];
  }
}

class _DashboardPlanBlock extends StatelessWidget {
  const _DashboardPlanBlock({required this.title, required this.lines});

  final String title;
  final List<String> lines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              title,
              style: theme.textTheme.labelLarge?.copyWith(
                color: Colors.white.withValues(alpha: 0.60),
                fontWeight: FontWeight.w800,
                letterSpacing: 0.35,
              ),
            ),
            const SizedBox(height: 10),
            ...lines.map(
              (line) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  '- $line',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.76),
                    height: 1.4,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
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

class _DashboardFocus {
  const _DashboardFocus({
    required this.kicker,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.accent,
    required this.route,
  });

  final String kicker;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color accent;
  final String route;

  factory _DashboardFocus.fromState({
    required dynamic session,
    required DashboardOverview overview,
    required HistoryOverview history,
    required MobileSyncStatus syncStatus,
    required _DashboardRoleProfile roleProfile,
  }) {
    if (history.failedSales > 0) {
      return _DashboardFocus(
        kicker: 'Needs attention',
        title: 'Review failed receipts',
        subtitle:
            '${history.failedSales} receipt${history.failedSales == 1 ? '' : 's'} still need attention. Open History and clear the blocked replay path first.',
        icon: Icons.error_outline_rounded,
        accent: const Color(0xFFFB7185),
        route: '/history',
      );
    }
    if (history.queuedSales > 0) {
      return _DashboardFocus(
        kicker: 'Queue watch',
        title: 'Clear queued receipts',
        subtitle:
            '${history.queuedSales} receipt${history.queuedSales == 1 ? '' : 's'} are waiting to upload. Retry sync before the queue grows.',
        icon: Icons.cloud_upload_rounded,
        accent: const Color(0xFFF59E0B),
        route: '/history',
      );
    }
    if (overview.metrics.lowStock > 0) {
      return _DashboardFocus(
        kicker: 'Stock watch',
        title: 'Refill low-stock items',
        subtitle:
            '${overview.metrics.lowStock} product${overview.metrics.lowStock == 1 ? '' : 's'} need refill attention. Jump into Inventory and scan the affected items.',
        icon: Icons.inventory_2_rounded,
        accent: const Color(0xFFFB7185),
        route: '/inventory',
      );
    }
    if (overview.todaySalesCount == 0) {
      return _DashboardFocus(
        kicker: 'Next move',
        title: roleProfile.primaryActionTitle,
        subtitle:
            '${roleProfile.primaryActionSubtitle}. The day is still quiet, so this is the fastest place to begin.',
        icon: Icons.flash_on_rounded,
        accent: const Color(0xFF38BDF8),
        route: '/pos',
      );
    }
    if (session?.isCashierLike ?? false) {
      return const _DashboardFocus(
        kicker: 'Keep selling',
        title: 'Jump back into checkout',
        subtitle:
            'Sales are already moving. Open POS and keep the next customer flow fast.',
        icon: Icons.point_of_sale_rounded,
        accent: Color(0xFF38BDF8),
        route: '/pos',
      );
    }
    if (syncStatus == MobileSyncStatus.syncing) {
      return const _DashboardFocus(
        kicker: 'Refreshing',
        title: 'Monitor live receipt flow',
        subtitle:
            'The app is syncing in the background. Open History to watch recent receipts land cleanly.',
        icon: Icons.sync_rounded,
        accent: Color(0xFF14B8A6),
        route: '/history',
      );
    }
    return const _DashboardFocus(
      kicker: 'Business pulse',
      title: 'Review today\'s activity',
      subtitle:
          'Revenue, receipts, and stock look healthy. Use History for a quick business check-in.',
      icon: Icons.query_stats_rounded,
      accent: Color(0xFF22C55E),
      route: '/history',
    );
  }
}

class _DashboardRow extends StatelessWidget {
  const _DashboardRow({
    required this.title,
    required this.subtitle,
    required this.trailing,
    required this.accent,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final String trailing;
  final Color accent;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
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
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: <Widget>[
                      Text(
                        trailing,
                        style: theme.textTheme.labelLarge?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (onTap != null) ...<Widget>[
                        const SizedBox(height: 6),
                        Icon(
                          Icons.chevron_right_rounded,
                          color: Colors.white.withValues(alpha: 0.45),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DashboardDetailSection extends StatelessWidget {
  const _DashboardDetailSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MobileSheetSection(
      title: title,
      accent: const Color(0xFFF59E0B),
      child: child,
    );
  }
}

class _DashboardSaleItemRow extends StatelessWidget {
  const _DashboardSaleItemRow({required this.item});

  final SaleDetailItem item;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                item.name,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                '${item.quantity} x ${formatCurrency(item.unitPrice)}${item.size?.isNotEmpty == true ? ' | ${item.size}' : ''}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.58),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
        Text(
          formatCurrency(item.lineTotal),
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: const Color(0xFF22C55E),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _DashboardSalePaymentRow extends StatelessWidget {
  const _DashboardSalePaymentRow({required this.payment});

  final SaleDetailPayment payment;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                payment.mode,
                style: Theme.of(
                  context,
                ).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
              if ((payment.referenceCode ?? '').isNotEmpty ||
                  (payment.note ?? '').isNotEmpty) ...<Widget>[
                const SizedBox(height: 4),
                Text(
                  payment.referenceCode ?? payment.note!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.58),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
        Text(
          formatCurrency(payment.amount),
          style: Theme.of(context).textTheme.labelLarge?.copyWith(
            color: const Color(0xFF38BDF8),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _DashboardSummaryRow extends StatelessWidget {
  const _DashboardSummaryRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final style = Theme.of(context).textTheme.bodyMedium?.copyWith(
      color: emphasize ? Colors.white : Colors.white.withValues(alpha: 0.72),
      fontWeight: emphasize ? FontWeight.w900 : FontWeight.w600,
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Expanded(child: Text(label, style: style)),
          const SizedBox(width: 16),
          Flexible(
            child: Text(value, textAlign: TextAlign.right, style: style),
          ),
        ],
      ),
    );
  }
}

String _syncLabel(CommerceSyncState state) {
  return switch (state) {
    CommerceSyncState.localOnly => 'LOCAL',
    CommerceSyncState.queued => 'QUEUED',
    CommerceSyncState.syncing => 'SYNCING',
    CommerceSyncState.synced => 'SYNCED',
    CommerceSyncState.failed => 'FAILED',
  };
}

Color _syncTone(CommerceSyncState state) {
  return switch (state) {
    CommerceSyncState.synced => const Color(0xFF22C55E),
    CommerceSyncState.queued => const Color(0xFFF59E0B),
    CommerceSyncState.syncing => const Color(0xFF38BDF8),
    CommerceSyncState.failed => const Color(0xFFFB7185),
    CommerceSyncState.localOnly => Colors.white70,
  };
}

String _resolvePulseRoute(String route) {
  switch (route) {
    case '/sales':
      return '/history';
    case '/plan':
      return '/settings/plan';
    case '/sessions':
      return '/settings/sessions';
    case '/audit':
    case '/migration':
    case '/erpnext':
      return '/settings/security';
    default:
      return route;
  }
}

Color _pulseToneColor(String tone) {
  switch (tone) {
    case 'critical':
    case 'danger':
      return const Color(0xFFFB7185);
    case 'warning':
      return const Color(0xFFF59E0B);
    case 'healthy':
      return const Color(0xFF22C55E);
    default:
      return const Color(0xFF38BDF8);
  }
}

Color _pulseSeverityColor(String severity) {
  switch (severity) {
    case 'critical':
      return const Color(0xFFFB7185);
    case 'warning':
      return const Color(0xFFF59E0B);
    default:
      return const Color(0xFF38BDF8);
  }
}
