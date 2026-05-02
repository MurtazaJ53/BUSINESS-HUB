import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final salesRepository = ref.watch(salesRepositoryProvider);
    final shopRepository = ref.watch(shopRepositoryProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final historyStream = salesRepository.watchHistoryOverview();
    final recentSalesStream = salesRepository.watchRecentSales(limit: 24);
    final domainStatesStream = shopRepository.watchTrackedDomainStates(
      const <String>['sales', 'payments'],
    );

    return StreamBuilder<HistoryOverview>(
      stream: historyStream,
      builder: (context, historySnapshot) {
        final overview = historySnapshot.data ?? HistoryOverview.empty();

        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: <Widget>[
            MobileHeroBanner(
              eyebrow: 'History feed',
              title: 'Receipt trail and replay health.',
              subtitle:
                  'This feed shows what the mobile vault already knows locally, how much is queued, and whether the backend cutover is stable enough for trust.',
              accent: const Color(0xFFF59E0B),
              trailing: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  MobileTag(
                    label: '${overview.totalSales} receipts',
                    icon: Icons.receipt_long_rounded,
                    accent: const Color(0xFFF59E0B),
                  ),
                  const SizedBox(height: 10),
                  MobileTag(
                    label: overview.queuedSales > 0
                        ? '${overview.queuedSales} queued'
                        : 'Replay clear',
                    icon: overview.queuedSales > 0
                        ? Icons.cloud_upload_rounded
                        : Icons.verified_rounded,
                    accent: overview.queuedSales > 0
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFF22C55E),
                  ),
                ],
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
                      accent: const Color(0xFF22C55E),
                    ),
                    MobileMetricCard(
                      label: 'Queued',
                      value: '${overview.queuedSales}',
                      caption: overview.queuedSales > 0
                          ? formatCurrency(overview.queuedRevenue)
                          : 'Outbox clear',
                      icon: Icons.cloud_upload_rounded,
                      accent: const Color(0xFFF59E0B),
                    ),
                    MobileMetricCard(
                      label: 'Attention',
                      value: '${overview.failedSales}',
                      caption: overview.failedSales > 0
                          ? 'Needs replay review'
                          : 'No failed receipts',
                      icon: Icons.error_outline_rounded,
                      accent: const Color(0xFFFB7185),
                    ),
                  ],
                );
              },
            ),
            const SizedBox(height: 18),
            StreamBuilder<List<DomainControlState>>(
              stream: domainStatesStream,
              builder: (context, domainSnapshot) {
                final states =
                    domainSnapshot.data ??
                    <DomainControlState>[
                      DomainControlState.legacy('sales'),
                      DomainControlState.legacy('payments'),
                    ];
                return MobilePanel(
                  title: 'Commerce cutover posture',
                  action: MobileTag(
                    label: syncStatus == MobileSyncStatus.syncing
                        ? 'Refreshing'
                        : 'Live posture',
                    icon: syncStatus == MobileSyncStatus.syncing
                        ? Icons.sync_rounded
                        : Icons.wifi_tethering_rounded,
                    accent: syncStatus == MobileSyncStatus.error
                        ? const Color(0xFFFB7185)
                        : const Color(0xFF38BDF8),
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
                );
              },
            ),
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Recent receipt feed',
              action: MobileTag(
                label: overview.lastSyncedAt == null
                    ? 'Freshness unknown'
                    : 'Last sync ${formatCompactDate(overview.lastSyncedAt!)}',
                icon: Icons.schedule_rounded,
                accent: const Color(0xFFA78BFA),
              ),
              child: StreamBuilder<List<RecentSaleSummary>>(
                stream: recentSalesStream,
                builder: (context, snapshot) {
                  final sales = snapshot.data ?? const <RecentSaleSummary>[];
                  if (sales.isEmpty) {
                    return MobileEmptyState(
                      icon: syncStatus == MobileSyncStatus.syncing
                          ? Icons.sync_rounded
                          : Icons.history_toggle_off_rounded,
                      title: syncStatus == MobileSyncStatus.syncing
                          ? 'Receipt feed is still landing'
                          : 'No receipt history yet',
                      body: syncStatus == MobileSyncStatus.syncing
                          ? 'Give the mobile vault a moment while it hydrates the recent commerce trail.'
                          : 'As soon as sales hit the local vault or backend replay, they will appear here.',
                    );
                  }

                  return Column(
                    children: sales
                        .map(
                          (sale) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _HistorySaleRow(sale: sale),
                          ),
                        )
                        .toList(growable: false),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}

class _DomainPostureRow extends StatelessWidget {
  const _DomainPostureRow({required this.state});

  final DomainControlState state;

  @override
  Widget build(BuildContext context) {
    final tone = switch (state.pilotSignoffStatus) {
      'production_safe' => const Color(0xFF22C55E),
      'ready_for_cutover' => const Color(0xFF38BDF8),
      'rollback_recommended' => const Color(0xFFFB7185),
      _ =>
        state.isPostgresPrimary
            ? const Color(0xFF22C55E)
            : const Color(0xFFF59E0B),
    };

    return DecoratedBox(
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
  const _HistorySaleRow({required this.sale});

  final RecentSaleSummary sale;

  @override
  Widget build(BuildContext context) {
    final tone = switch (sale.syncState) {
      CommerceSyncState.synced => const Color(0xFF22C55E),
      CommerceSyncState.queued => const Color(0xFFF59E0B),
      CommerceSyncState.syncing => const Color(0xFF38BDF8),
      CommerceSyncState.failed => const Color(0xFFFB7185),
      CommerceSyncState.localOnly => Colors.white70,
    };
    final stateLabel = switch (sale.syncState) {
      CommerceSyncState.synced => 'SYNCED',
      CommerceSyncState.queued => 'QUEUED',
      CommerceSyncState.syncing => 'SYNCING',
      CommerceSyncState.failed => 'FAILED',
      CommerceSyncState.localOnly => 'LOCAL',
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
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
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
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
                  MobileTag(
                    label: sale.paymentMode,
                    icon: Icons.payments_rounded,
                    accent: const Color(0xFF38BDF8),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              stateLabel,
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
