import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/runtime/app_runtime_info.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final shopRepository = ref.watch(shopRepositoryProvider);
    final salesRepository = ref.watch(salesRepositoryProvider);
    final backendApiClient = ref.watch(backendApiClientProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final runtimeInfoAsync = ref.watch(appRuntimeInfoProvider);
    final shopStream = shopRepository.watchShopInfo();
    final historyStream = salesRepository.watchHistoryOverview();
    final pendingOutboxStream = salesRepository.watchPendingOutboxCount();

    return StreamBuilder<ShopInfo>(
      stream: shopStream,
      builder: (context, shopSnapshot) {
        final shop = shopSnapshot.data ?? ShopInfo.fallback();
        return StreamBuilder<HistoryOverview>(
          stream: historyStream,
          builder: (context, historySnapshot) {
            final history = historySnapshot.data ?? HistoryOverview.empty();
            return StreamBuilder<int>(
              stream: pendingOutboxStream,
              builder: (context, outboxSnapshot) {
                final pending = outboxSnapshot.data ?? 0;
                return ListView(
                  padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
                  children: <Widget>[
                    MobileScreenLead(
                      title: 'Settings',
                      subtitle:
                          'Keep daily settings simple. Heavy rollout and recovery tools live in Advanced Ops only.',
                      icon: Icons.settings_rounded,
                      accent: const Color(0xFFA78BFA),
                      primaryTag: MobileTag(
                        label: session?.role?.toUpperCase() ?? 'GUEST',
                        icon: Icons.badge_rounded,
                        accent: const Color(0xFFA78BFA),
                      ),
                      secondaryTag: MobileTag(
                        label: switch (syncStatus) {
                          MobileSyncStatus.syncing => 'Working',
                          MobileSyncStatus.error => 'Needs attention',
                          MobileSyncStatus.offline => 'Offline',
                          MobileSyncStatus.idle => 'Stable',
                        },
                        icon: switch (syncStatus) {
                          MobileSyncStatus.syncing => Icons.sync_rounded,
                          MobileSyncStatus.error => Icons.error_outline_rounded,
                          MobileSyncStatus.offline => Icons.cloud_off_rounded,
                          MobileSyncStatus.idle => Icons.verified_rounded,
                        },
                        accent: switch (syncStatus) {
                          MobileSyncStatus.syncing => const Color(0xFF38BDF8),
                          MobileSyncStatus.error => const Color(0xFFFB7185),
                          MobileSyncStatus.offline => const Color(0xFFF59E0B),
                          MobileSyncStatus.idle => const Color(0xFF22C55E),
                        },
                      ),
                    ),
                    const SizedBox(height: 18),
                    MobilePanel(
                      title: 'Workspace',
                      action: MobileTag(
                        label: session?.shopId ?? 'No shop',
                        icon: Icons.storefront_rounded,
                        accent: const Color(0xFF14B8A6),
                      ),
                      child: Column(
                        children: <Widget>[
                          _SettingsRow(
                            label: 'Workspace',
                            value: shop.name,
                            icon: Icons.storefront_rounded,
                          ),
                          _SettingsRow(
                            label: 'Operator',
                            value: session != null && session.email.isNotEmpty
                                ? session.email
                                : 'Not signed in',
                            icon: Icons.person_rounded,
                          ),
                          _SettingsRow(
                            label: 'Role',
                            value: session?.role?.toUpperCase() ?? 'UNKNOWN',
                            icon: Icons.admin_panel_settings_rounded,
                          ),
                          _SettingsRow(
                            label: 'Backend API',
                            value: backendApiClient.baseUrl,
                            icon: Icons.cloud_outlined,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    MobilePanel(
                      title: 'Sync health',
                      action: MobileTag(
                        label: pending > 0 ? '$pending queued' : 'Queue clear',
                        icon: pending > 0
                            ? Icons.cloud_upload_rounded
                            : Icons.check_circle_rounded,
                        accent: pending > 0
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFF22C55E),
                      ),
                      child: Column(
                        children: <Widget>[
                          _SettingsRow(
                            label: 'Sync posture',
                            value: syncStatus.name.toUpperCase(),
                            icon: Icons.sync_alt_rounded,
                          ),
                          _SettingsRow(
                            label: 'Queued commands',
                            value: '$pending',
                            icon: Icons.outbox_rounded,
                          ),
                          _SettingsRow(
                            label: 'Queued value',
                            value: formatCurrency(history.queuedRevenue),
                            icon: Icons.currency_rupee_rounded,
                          ),
                          _SettingsRow(
                            label: 'Failed receipts',
                            value: '${history.failedSales}',
                            icon: Icons.error_outline_rounded,
                          ),
                          _SettingsRow(
                            label: 'Last receipt sync',
                            value: history.lastSyncedAt == null
                                ? 'Unknown'
                                : formatCompactDate(history.lastSyncedAt!),
                            icon: Icons.schedule_rounded,
                          ),
                          const SizedBox(height: 8),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final stacked = constraints.maxWidth < 430;
                              final actions = <Widget>[
                                Expanded(
                                  child: FilledButton.tonalIcon(
                                    onPressed: () async {
                                      await syncCoordinator.refresh();
                                      if (!context.mounted) {
                                        return;
                                      }
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Workspace refresh requested.',
                                          ),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.refresh_rounded),
                                    label: const Text('Refresh'),
                                  ),
                                ),
                                Expanded(
                                  child: FilledButton.tonalIcon(
                                    onPressed: pending > 0
                                        ? () async {
                                            final result =
                                                await syncCoordinator
                                                    .flushCommerceOutbox();
                                            if (!context.mounted) {
                                              return;
                                            }
                                            ScaffoldMessenger.of(context)
                                                .showSnackBar(
                                                  SnackBar(
                                                    content: Text(
                                                      result.message ??
                                                          'Outbox flush requested.',
                                                    ),
                                                  ),
                                                );
                                          }
                                        : null,
                                    icon: const Icon(
                                      Icons.cloud_upload_rounded,
                                    ),
                                    label: const Text('Retry queue'),
                                  ),
                                ),
                              ];

                              if (stacked) {
                                return Column(
                                  children: <Widget>[
                                    actions[0],
                                    const SizedBox(height: 10),
                                    actions[1],
                                  ],
                                );
                              }

                              return Row(
                                children: <Widget>[
                                  actions[0],
                                  const SizedBox(width: 10),
                                  actions[1],
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                    MobilePanel(
                      title: 'App',
                      action: MobileTag(
                        label: runtimeInfoAsync.asData?.value.versionLabel ??
                            'Loading',
                        icon: Icons.new_releases_rounded,
                        accent: const Color(0xFF38BDF8),
                      ),
                      child: runtimeInfoAsync.when(
                        data: (runtime) => Column(
                          children: <Widget>[
                            _SettingsRow(
                              label: 'App',
                              value: runtime.appName,
                              icon: Icons.android_rounded,
                            ),
                            _SettingsRow(
                              label: 'Version',
                              value: runtime.versionLabel,
                              icon: Icons.sell_rounded,
                            ),
                            _SettingsRow(
                              label: 'Release channel',
                              value: runtime.releaseFingerprint,
                              icon: Icons.flag_rounded,
                            ),
                            _SettingsRow(
                              label: 'Package',
                              value: runtime.packageName,
                              icon: Icons.inventory_2_rounded,
                            ),
                          ],
                        ),
                        loading: () => const MobileEmptyState(
                          icon: Icons.sync_rounded,
                          title: 'Loading app info',
                          body: 'The app is resolving runtime metadata.',
                        ),
                        error: (error, _) => MobileEmptyState(
                          icon: Icons.error_outline_rounded,
                          title: 'App info unavailable',
                          body: error.toString(),
                        ),
                      ),
                    ),
                    const SizedBox(height: 18),
                    MobilePanel(
                      title: 'Account and support',
                      action: MobileTag(
                        label: 'FAST PATH',
                        icon: Icons.flash_on_rounded,
                        accent: const Color(0xFF22C55E),
                      ),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          final stacked = constraints.maxWidth < 430;
                          final actions = <Widget>[
                            Expanded(
                              child: FilledButton.tonalIcon(
                                onPressed: () {
                                  context.push('/settings/advanced');
                                },
                                icon: const Icon(Icons.tune_rounded),
                                label: const Text('Advanced ops'),
                              ),
                            ),
                            Expanded(
                              child: FilledButton.tonalIcon(
                                onPressed: () async {
                                  await FirebaseAuth.instance.signOut();
                                  if (!context.mounted) {
                                    return;
                                  }
                                  context.go('/');
                                },
                                icon: const Icon(Icons.logout_rounded),
                                label: const Text('Sign out'),
                              ),
                            ),
                          ];

                          if (stacked) {
                            return Column(
                              children: <Widget>[
                                actions[0],
                                const SizedBox(height: 10),
                                actions[1],
                              ],
                            );
                          }

                          return Row(
                            children: <Widget>[
                              actions[0],
                              const SizedBox(width: 10),
                              actions[1],
                            ],
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
            );
          },
        );
      },
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: const Color(0xFF0A1220),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: const Color(0xFF111827),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: Colors.white70, size: 18),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label.toUpperCase(),
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.48),
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      value,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: Colors.white.withValues(alpha: 0.9),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
