import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/insights/mobile_operational_insights.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  const HistoryScreen({super.key});

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  HistoryFilter _filter = const HistoryFilter();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _resetFilters() {
    _searchController.clear();
    setState(() {
      _filter = const HistoryFilter();
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final salesRepository = ref.read(salesRepositoryProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final overview =
        ref.watch(historyOverviewProvider).asData?.value ??
        HistoryOverview.empty();
    final sales =
        ref.watch(historySalesProvider(_filter)).asData?.value ??
        const <RecentSaleSummary>[];
    final states =
        ref.watch(historyDomainStatesProvider).asData?.value ??
        <DomainControlState>[
          DomainControlState.legacy('sales'),
          DomainControlState.legacy('payments'),
        ];
    final report = HistoryReportSnapshot.fromSales(sales);
    final showOperationalSummary = shop.normalizedPlanTier != 'starter';
    final showAdvancedReport = shop.supportsAdvancedReports;
    final hasActiveFilters =
        _filter.search.trim().isNotEmpty ||
        _filter.syncState != null ||
        _filter.paymentMode != null ||
        _filter.dateWindow != HistoryDateWindow.all ||
        _filter.onlyDueSales;
    final roleProfile = _HistoryRoleProfile.fromSession(
      session: session,
      overview: overview,
      syncStatus: syncStatus,
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
      children: <Widget>[
        MobileScreenLead(
          title: roleProfile.leadTitle,
          subtitle: roleProfile.leadSubtitle,
          icon: roleProfile.leadIcon,
          accent: roleProfile.leadAccent,
          primaryTag: MobileTag(
            label: roleProfile.primaryTagLabel,
            icon: roleProfile.primaryTagIcon,
            accent: roleProfile.primaryTagAccent,
          ),
          secondaryTag: MobileTag(
            label: roleProfile.secondaryTagLabel,
            icon: roleProfile.secondaryTagIcon,
            accent: roleProfile.secondaryTagAccent,
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
                  label: 'Gross',
                  value: formatCurrency(overview.totalRevenue),
                  caption: '${overview.totalSales} stored receipts',
                  icon: Icons.currency_rupee_rounded,
                ),
                MobileMetricCard(
                  label: 'Synced',
                  value: '${overview.syncedSales}',
                  caption: 'Accepted by backend',
                  icon: Icons.verified_rounded,
                  accent: const Color(0xFF4EB79B),
                ),
                MobileMetricCard(
                  label: 'Queued',
                  value: '${overview.queuedSales}',
                  caption: overview.queuedSales > 0
                      ? formatCurrency(overview.queuedRevenue)
                      : 'Outbox clear',
                  icon: Icons.cloud_upload_rounded,
                  accent: const Color(0xFFF0C879),
                ),
                MobileMetricCard(
                  label: 'Attention',
                  value: '${overview.failedSales}',
                  caption: overview.failedSales > 0
                      ? 'Needs replay review'
                      : 'No failed receipts',
                  icon: Icons.error_outline_rounded,
                  accent: const Color(0xFFEF6B67),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: roleProfile.filterPanelTitle,
          action: MobileTag(
            label: _filter.syncState == null
                ? 'ALL STATES'
                : _syncLabel(_filter.syncState!),
            icon: Icons.tune_rounded,
            accent: const Color(0xFF7CA4F8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              TextField(
                controller: _searchController,
                onChanged: (value) {
                  setState(() {
                    _filter = _filter.copyWith(search: value);
                  });
                },
                decoration: InputDecoration(
                  hintText: 'Search customer, phone, or local receipt id',
                  prefixIcon: const Icon(Icons.search_rounded),
                  suffixIcon: _filter.search.isEmpty
                      ? null
                      : IconButton(
                          onPressed: () {
                            _searchController.clear();
                            setState(() {
                              _filter = _filter.copyWith(search: '');
                            });
                          },
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
              ),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  _SyncFilterChip(
                    label: 'All',
                    active: _filter.syncState == null,
                    onTap: () {
                      setState(() {
                        _filter = _filter.copyWith(clearSyncState: true);
                      });
                    },
                  ),
                  ...CommerceSyncState.values.map(
                    (state) => _SyncFilterChip(
                      label: _syncLabel(state),
                      active: _filter.syncState == state,
                      onTap: () {
                        setState(() {
                          _filter = _filter.copyWith(syncState: state);
                        });
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  _SyncFilterChip(
                    label: 'Any pay',
                    active: _filter.paymentMode == null,
                    onTap: () {
                      setState(() {
                        _filter = _filter.copyWith(clearPaymentMode: true);
                      });
                    },
                  ),
                  ..._historyPaymentModes.map(
                    (mode) => _SyncFilterChip(
                      label: mode,
                      active: _filter.paymentMode == mode,
                      onTap: () {
                        setState(() {
                          _filter = _filter.copyWith(paymentMode: mode);
                        });
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: HistoryDateWindow.values
                    .map(
                      (window) => _SyncFilterChip(
                        label: window.label,
                        active: _filter.dateWindow == window,
                        onTap: () {
                          setState(() {
                            _filter = _filter.copyWith(dateWindow: window);
                          });
                        },
                      ),
                    )
                    .toList(growable: false),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: <Widget>[
                  _SyncFilterChip(
                    label: _filter.onlyDueSales ? 'Due only' : 'All balances',
                    active: _filter.onlyDueSales,
                    onTap: () {
                      setState(() {
                        _filter = _filter.copyWith(
                          onlyDueSales: !_filter.onlyDueSales,
                        );
                      });
                    },
                  ),
                ],
              ),
              if (hasActiveFilters) ...<Widget>[
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    if (_filter.search.trim().isNotEmpty)
                      MobileTag(
                        label: 'Search: ${_filter.search.trim()}',
                        icon: Icons.search_rounded,
                        accent: const Color(0xFFE58A47),
                      ),
                    if (_filter.syncState != null)
                      MobileTag(
                        label: _syncLabel(_filter.syncState!),
                        icon: Icons.sync_alt_rounded,
                        accent: const Color(0xFF7CA4F8),
                      ),
                    if (_filter.paymentMode != null)
                      MobileTag(
                        label: _filter.paymentMode!,
                        icon: Icons.payments_rounded,
                        accent: const Color(0xFF4EB79B),
                      ),
                    if (_filter.dateWindow != HistoryDateWindow.all)
                      MobileTag(
                        label: _filter.dateWindow.label,
                        icon: Icons.date_range_rounded,
                        accent: const Color(0xFFF0C879),
                      ),
                    if (_filter.onlyDueSales)
                      const MobileTag(
                        label: 'Due only',
                        icon: Icons.account_balance_wallet_rounded,
                        accent: Color(0xFFEF6B67),
                      ),
                  ],
                ),
                const SizedBox(height: 12),
                Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonalIcon(
                    onPressed: _resetFilters,
                    icon: const Icon(Icons.restart_alt_rounded),
                    label: const Text('Clear filters'),
                  ),
                ),
              ],
              const SizedBox(height: 12),
              FilledButton.tonalIcon(
                onPressed: overview.queuedSales > 0 || overview.failedSales > 0
                    ? () async {
                        final result = await syncCoordinator
                            .flushCommerceOutbox();
                        if (!context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              result.message ??
                                  'Queued receipts are being retried.',
                            ),
                          ),
                        );
                      }
                    : null,
                icon: const Icon(Icons.cloud_upload_rounded),
                label: const Text('Retry receipt sync'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: 'Sync lanes',
          action: MobileTag(
            label: syncStatus == MobileSyncStatus.syncing
                ? 'Refreshing'
                : 'Live posture',
            icon: syncStatus == MobileSyncStatus.syncing
                ? Icons.sync_rounded
                : Icons.wifi_tethering_rounded,
            accent: syncStatus == MobileSyncStatus.error
                ? const Color(0xFFEF6B67)
                : const Color(0xFFE58A47),
          ),
          child: Column(
            children: states
                .map(
                  (state) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _DomainPostureRow(state: state),
                  ),
                )
                .toList(growable: false),
          ),
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: roleProfile.summaryPanelTitle,
          action: MobileTag(
            label: _filter.dateWindow.label,
            icon: Icons.insights_rounded,
            accent: const Color(0xFF4EB79B),
          ),
          child: sales.isEmpty
              ? const MobileEmptyState(
                  icon: Icons.query_stats_rounded,
                  title: 'No data for this filter',
                  body:
                      'Broaden the search, date window, or payment filters to generate a live report pulse.',
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: <Widget>[
                        _HistoryMetricTile(
                          label: 'Receipts',
                          value: '${report.receiptCount}',
                          tone: const Color(0xFFF0C879),
                        ),
                        _HistoryMetricTile(
                          label: 'Gross',
                          value: formatCurrency(report.grossTotal),
                          tone: const Color(0xFF4EB79B),
                        ),
                        if (showOperationalSummary)
                          _HistoryMetricTile(
                            label: 'Collected',
                            value: formatCurrency(report.collectedTotal),
                            tone: const Color(0xFFE58A47),
                          ),
                        if (showOperationalSummary)
                          _HistoryMetricTile(
                            label: 'Due',
                            value: formatCurrency(report.dueTotal),
                            tone: report.dueTotal > 0
                                ? const Color(0xFFF0C879)
                                : const Color(0xFF4EB79B),
                          ),
                        if (showAdvancedReport)
                          _HistoryMetricTile(
                            label: 'Avg ticket',
                            value: formatCurrency(report.averageTicketValue),
                            tone: const Color(0xFF7CA4F8),
                          ),
                        if (showAdvancedReport)
                          _HistoryMetricTile(
                            label: 'Named buyers',
                            value: '${report.namedBuyerCount}',
                            tone: const Color(0xFF4EB79B),
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      '${report.syncedCount} synced | ${report.queuedCount} queued | ${report.failedCount} failed',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.62),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      showAdvancedReport
                          ? (report.topPaymentMode == null
                                ? 'No payment mode mix available yet.'
                                : 'Top mode ${report.topPaymentMode} | ${report.dueReceiptCount} receipt(s) still carry due balance | ${report.walkInCount} walk-in sale(s).')
                          : showOperationalSummary
                          ? '${shop.planLabel} keeps reporting lighter here. Upgrade to Pro for payment-mix and buyer-pattern insights.'
                          : '${shop.planLabel} focuses on simple receipt review. Upgrade to unlock deeper report rollups.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.54),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (showAdvancedReport &&
                        report.paymentMix.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 14),
                      Text(
                        'Payment mix',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...report.paymentMix.map(
                        (mix) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _HistoryPaymentMixRow(mix: mix),
                        ),
                      ),
                    ],
                  ],
                ),
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: roleProfile.feedPanelTitle,
          action: MobileTag(
            label: overview.lastSyncedAt == null
                ? 'Freshness unknown'
                : 'Last sync ${formatCompactDate(overview.lastSyncedAt!)}',
            icon: Icons.schedule_rounded,
            accent: const Color(0xFF7CA4F8),
          ),
          child: sales.isEmpty
              ? MobileEmptyState(
                  icon: syncStatus == MobileSyncStatus.syncing
                      ? Icons.sync_rounded
                      : Icons.history_toggle_off_rounded,
                  title: syncStatus == MobileSyncStatus.syncing
                      ? 'Receipt feed is still landing'
                      : 'No receipt history yet',
                  body: syncStatus == MobileSyncStatus.syncing
                      ? 'Give the mobile vault a moment while it hydrates the recent commerce trail.'
                      : 'As soon as sales hit the local vault or backend replay, they will appear here.',
                )
              : Column(
                  children: sales
                      .map(
                        (sale) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _HistorySaleRow(
                            sale: sale,
                            onTap: () =>
                                _openSaleDetail(context, salesRepository, sale),
                          ),
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
                        title: formatCurrency(detail.total),
                        subtitle:
                            '${detail.customerName?.isNotEmpty == true ? detail.customerName : 'Walk-in customer'} | ${detail.date}',
                        icon: Icons.receipt_long_rounded,
                        accent: const Color(0xFFF0C879),
                        tags: <Widget>[
                          MobileTag(
                            label: _syncLabel(detail.syncState),
                            icon: Icons.cloud_done_rounded,
                            accent: _syncTone(detail.syncState),
                          ),
                          MobileTag(
                            label: detail.paymentMode,
                            icon: Icons.payments_rounded,
                            accent: const Color(0xFFE58A47),
                          ),
                          MobileTag(
                            label: '${detail.itemCount} items',
                            icon: Icons.shopping_bag_rounded,
                            accent: const Color(0xFF7CA4F8),
                          ),
                          if (detail.hasOutstandingDue)
                            MobileTag(
                              label: 'Due ${formatCurrency(detail.amountDue)}',
                              icon: Icons.warning_amber_rounded,
                              accent: const Color(0xFFF0C879),
                            ),
                        ],
                      ),
                      const SizedBox(height: 18),
                      _SaleDetailSection(
                        title: 'Items',
                        child: Column(
                          children: detail.items
                              .map(
                                (item) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _SaleItemRow(item: item),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _SaleDetailSection(
                        title: 'Payments',
                        child: Column(
                          children: detail.payments
                              .map(
                                (payment) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: _SalePaymentRow(payment: payment),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ),
                      const SizedBox(height: 14),
                      _SaleDetailSection(
                        title: 'Summary',
                        child: Column(
                          children: <Widget>[
                            _SaleSummaryRow(
                              label: 'Subtotal',
                              value: formatCurrency(detail.subtotal),
                            ),
                            _SaleSummaryRow(
                              label: 'Discount',
                              value: formatCurrency(detail.discount),
                            ),
                            _SaleSummaryRow(
                              label: 'Total',
                              value: formatCurrency(detail.total),
                              emphasize: true,
                            ),
                            _SaleSummaryRow(
                              label: 'Collected',
                              value: formatCurrency(detail.amountReceived),
                            ),
                            _SaleSummaryRow(
                              label: 'Due outstanding',
                              value: formatCurrency(detail.amountDue),
                              emphasize: detail.hasOutstandingDue,
                            ),
                            if ((detail.customerPhone ?? '').isNotEmpty)
                              _SaleSummaryRow(
                                label: 'Phone',
                                value: detail.customerPhone!,
                              ),
                            if ((detail.footerNote ?? '').isNotEmpty)
                              _SaleSummaryRow(
                                label: 'Footer note',
                                value: detail.footerNote!,
                              ),
                            if ((detail.commandId ?? '').isNotEmpty)
                              _SaleSummaryRow(
                                label: 'Command',
                                value: detail.commandId!,
                              ),
                            if ((detail.lastSyncError ?? '').isNotEmpty)
                              _SaleSummaryRow(
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

class _HistoryRoleProfile {
  const _HistoryRoleProfile({
    required this.leadTitle,
    required this.leadSubtitle,
    required this.leadIcon,
    required this.leadAccent,
    required this.primaryTagLabel,
    required this.primaryTagIcon,
    required this.primaryTagAccent,
    required this.secondaryTagLabel,
    required this.secondaryTagIcon,
    required this.secondaryTagAccent,
    required this.filterPanelTitle,
    required this.summaryPanelTitle,
    required this.feedPanelTitle,
  });

  final String leadTitle;
  final String leadSubtitle;
  final IconData leadIcon;
  final Color leadAccent;
  final String primaryTagLabel;
  final IconData primaryTagIcon;
  final Color primaryTagAccent;
  final String secondaryTagLabel;
  final IconData secondaryTagIcon;
  final Color secondaryTagAccent;
  final String filterPanelTitle;
  final String summaryPanelTitle;
  final String feedPanelTitle;

  factory _HistoryRoleProfile.fromSession({
    required dynamic session,
    required HistoryOverview overview,
    required MobileSyncStatus syncStatus,
  }) {
    final primaryLabel = '${overview.totalSales} receipts';
    final primaryIcon = Icons.receipt_long_rounded;
    final primaryAccent = const Color(0xFFF0C879);
    final secondaryLabel = overview.queuedSales > 0
        ? '${overview.queuedSales} queued'
        : (syncStatus == MobileSyncStatus.syncing ? 'Syncing' : 'Replay clear');
    final secondaryIcon = overview.queuedSales > 0
        ? Icons.cloud_upload_rounded
        : (syncStatus == MobileSyncStatus.syncing
              ? Icons.sync_rounded
              : Icons.verified_rounded);
    final secondaryAccent = overview.queuedSales > 0
        ? const Color(0xFFF0C879)
        : const Color(0xFF4EB79B);

    if (session?.isCashierLike ?? false) {
      return _HistoryRoleProfile(
        leadTitle: overview.totalSales > 0
            ? 'Recent sales are ready'
            : 'Receipt search is ready',
        leadSubtitle:
            'Find receipts fast, check queued sync, and open exact sale details without leaving the floor workflow.',
        leadIcon: Icons.receipt_long_rounded,
        leadAccent: const Color(0xFFF0C879),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: primaryIcon,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: secondaryIcon,
        secondaryTagAccent: secondaryAccent,
        filterPanelTitle: 'Find sales',
        summaryPanelTitle: 'Quick summary',
        feedPanelTitle: 'Receipt list',
      );
    }

    if (session?.isManager ?? false) {
      return _HistoryRoleProfile(
        leadTitle: overview.totalSales > 0
            ? 'Sales history is live'
            : 'History is ready',
        leadSubtitle:
            'Track recent receipts, queue posture, and filter-driven sales summaries from one cleaner history view.',
        leadIcon: Icons.receipt_long_rounded,
        leadAccent: const Color(0xFFF0C879),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: primaryIcon,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: secondaryIcon,
        secondaryTagAccent: secondaryAccent,
        filterPanelTitle: 'Find receipts',
        summaryPanelTitle: 'Quick summary',
        feedPanelTitle: 'Receipt list',
      );
    }

    return _HistoryRoleProfile(
      leadTitle: overview.totalSales > 0
          ? 'Receipt history is live'
          : 'History pulse is ready',
      leadSubtitle:
          'Review revenue flow, replay posture, and recent sales without turning the mobile app into a dense reporting console.',
      leadIcon: Icons.receipt_long_rounded,
      leadAccent: const Color(0xFFF0C879),
      primaryTagLabel: primaryLabel,
      primaryTagIcon: primaryIcon,
      primaryTagAccent: primaryAccent,
      secondaryTagLabel: secondaryLabel,
      secondaryTagIcon: secondaryIcon,
      secondaryTagAccent: secondaryAccent,
      filterPanelTitle: 'Find receipts',
      summaryPanelTitle: 'Quick summary',
      feedPanelTitle: 'Receipt list',
    );
  }
}

class _SyncFilterChip extends StatelessWidget {
  const _SyncFilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final activeColor = const Color(0xFF7CA4F8);
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: Material(
        color: active
            ? activeColor.withValues(alpha: 0.14)
            : const Color(0xFF232A36),
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Text(
              label,
              style: TextStyle(
                color: active ? activeColor : Colors.white70,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DomainPostureRow extends StatelessWidget {
  const _DomainPostureRow({required this.state});

  final DomainControlState state;

  @override
  Widget build(BuildContext context) {
    final tone = switch (state.pilotSignoffStatus) {
      'production_safe' => const Color(0xFF4EB79B),
      'ready_for_cutover' => const Color(0xFFE58A47),
      'rollback_recommended' => const Color(0xFFEF6B67),
      _ =>
        state.isPostgresPrimary
            ? const Color(0xFF4EB79B)
            : const Color(0xFFF0C879),
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF232A36),
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
              decoration: BoxDecoration(color: tone, shape: BoxShape.circle),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    state.domain.toUpperCase(),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    state.pilotSignoffSummary ??
                        '${state.postureLabel} | epoch ${state.currentEpoch}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              state.pilotSignoffStatus?.replaceAll('_', ' ').toUpperCase() ??
                  state.postureLabel.toUpperCase(),
              textAlign: TextAlign.right,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: tone,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistorySaleRow extends StatelessWidget {
  const _HistorySaleRow({required this.sale, required this.onTap});

  final RecentSaleSummary sale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tone = _syncTone(sale.syncState);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF232A36),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 46,
                  height: 46,
                  decoration: BoxDecoration(
                    color: tone.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(Icons.receipt_long_rounded, color: tone),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        formatCurrency(sale.total),
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${sale.customerName?.isNotEmpty == true ? sale.customerName : 'Walk-in customer'} | ${sale.date}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.58),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: <Widget>[
                          MobileTag(
                            label: sale.paymentMode,
                            icon: Icons.payments_rounded,
                            accent: const Color(0xFFE58A47),
                          ),
                          if (sale.hasOutstandingDue)
                            MobileTag(
                              label: 'Due ${formatCurrency(sale.amountDue)}',
                              icon: Icons.warning_amber_rounded,
                              accent: const Color(0xFFF0C879),
                            ),
                          Text(
                            'Tap for detail',
                            style: Theme.of(context).textTheme.labelSmall
                                ?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.56),
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  _syncLabel(sale.syncState),
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: tone,
                    fontWeight: FontWeight.w900,
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

class _SaleDetailSection extends StatelessWidget {
  const _SaleDetailSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MobileSheetSection(
      title: title,
      accent: const Color(0xFFF0C879),
      child: child,
    );
  }
}

class _SaleItemRow extends StatelessWidget {
  const _SaleItemRow({required this.item});

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
            color: const Color(0xFF4EB79B),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _SalePaymentRow extends StatelessWidget {
  const _SalePaymentRow({required this.payment});

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
            color: const Color(0xFFE58A47),
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _HistoryMetricTile extends StatelessWidget {
  const _HistoryMetricTile({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF232A36),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.white.withValues(alpha: 0.58),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: tone,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HistoryPaymentMixRow extends StatelessWidget {
  const _HistoryPaymentMixRow({required this.mix});

  final PaymentModeMixStats mix;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF232A36),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    mix.mode,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${mix.count} receipt(s) Â· ${mix.shareLabel}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              formatCurrency(mix.grossAmount),
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: const Color(0xFFE58A47),
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SaleSummaryRow extends StatelessWidget {
  const _SaleSummaryRow({
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

const List<String> _historyPaymentModes = <String>[
  'CASH',
  'UPI',
  'BANK',
  'CARD',
  'CREDIT',
  'OTHER',
  'SPLIT',
  'OTHERS',
];

Color _syncTone(CommerceSyncState state) {
  return switch (state) {
    CommerceSyncState.synced => const Color(0xFF4EB79B),
    CommerceSyncState.queued => const Color(0xFFF0C879),
    CommerceSyncState.syncing => const Color(0xFFE58A47),
    CommerceSyncState.failed => const Color(0xFFEF6B67),
    CommerceSyncState.localOnly => Colors.white70,
  };
}
