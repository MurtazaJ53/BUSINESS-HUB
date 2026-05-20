import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
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
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final runtimeInfoAsync = ref.watch(appRuntimeInfoProvider);
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final history =
        ref.watch(historyOverviewProvider).asData?.value ??
        HistoryOverview.empty();
    final pending = ref.watch(pendingOutboxCountProvider).asData?.value ?? 0;
    final profile = _SettingsRoleProfile.fromSession(session);

    return MobileStandaloneScaffold(
      title: profile.screenTitle,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: <Widget>[
          MobileScreenLead(
            title: profile.leadTitle,
            subtitle: profile.leadSubtitle,
            icon: profile.leadIcon,
            accent: profile.leadAccent,
            primaryTag: MobileTag(
              label: session?.displayRoleLabel ?? 'GUEST',
              icon: Icons.badge_rounded,
              accent: profile.leadAccent,
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
              label: profile.workspaceTag,
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
                  value: session?.displayRoleLabel ?? 'UNKNOWN',
                  icon: Icons.admin_panel_settings_rounded,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: profile.syncPanelTitle,
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
                  value: profile.syncLabelFor(syncStatus),
                  icon: Icons.sync_alt_rounded,
                ),
                _SettingsRow(
                  label: 'Queued receipts',
                  value: '$pending',
                  icon: Icons.outbox_rounded,
                ),
                _SettingsRow(
                  label: 'Last receipt sync',
                  value: history.lastSyncedAt == null
                      ? 'Unknown'
                      : formatCompactDate(history.lastSyncedAt!),
                  icon: Icons.schedule_rounded,
                ),
                if (profile.showOwnerSyncDetails) ...<Widget>[
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
                ],
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
                                content: Text('Workspace refresh requested.'),
                              ),
                            );
                          },
                          icon: const Icon(Icons.refresh_rounded),
                          label: Text(profile.refreshButtonLabel),
                        ),
                      ),
                      Expanded(
                        child: FilledButton.tonalIcon(
                          onPressed: pending > 0
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
                                            'Queued receipts retry requested.',
                                      ),
                                    ),
                                  );
                                }
                              : null,
                          icon: const Icon(Icons.cloud_upload_rounded),
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
              label: runtimeInfoAsync.asData?.value.versionLabel ?? 'Loading',
              icon: Icons.new_releases_rounded,
              accent: const Color(0xFF38BDF8),
            ),
            child: runtimeInfoAsync.when(
              data: (runtime) => Column(
                children: <Widget>[
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
                  if (profile.showOwnerSyncDetails) ...<Widget>[
                    _SettingsRow(
                      label: 'App',
                      value: runtime.appName,
                      icon: Icons.android_rounded,
                    ),
                    _SettingsRow(
                      label: 'Package',
                      value: runtime.packageName,
                      icon: Icons.inventory_2_rounded,
                    ),
                  ],
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
            title: profile.accountPanelTitle,
            action: MobileTag(
              label: profile.accountTag,
              icon: profile.accountIcon,
              accent: profile.accountAccent,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final stacked = constraints.maxWidth < 430;
                final actions = <Widget>[
                  if (profile.showAdvancedOpsButton)
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
                    children: actions
                        .expand((widget) => <Widget>[
                              widget,
                              if (widget != actions.last)
                                const SizedBox(height: 10),
                            ])
                        .toList(growable: false),
                  );
                }

                return Row(
                  children: actions
                      .expand((widget) => <Widget>[
                            widget,
                            if (widget != actions.last)
                              const SizedBox(width: 10),
                          ])
                      .toList(growable: false),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsRoleProfile {
  const _SettingsRoleProfile({
    required this.screenTitle,
    required this.leadTitle,
    required this.leadSubtitle,
    required this.leadIcon,
    required this.leadAccent,
    required this.workspaceTag,
    required this.syncPanelTitle,
    required this.refreshButtonLabel,
    required this.accountPanelTitle,
    required this.accountTag,
    required this.accountIcon,
    required this.accountAccent,
    required this.showAdvancedOpsButton,
    required this.showOwnerSyncDetails,
  });

  final String screenTitle;
  final String leadTitle;
  final String leadSubtitle;
  final IconData leadIcon;
  final Color leadAccent;
  final String workspaceTag;
  final String syncPanelTitle;
  final String refreshButtonLabel;
  final String accountPanelTitle;
  final String accountTag;
  final IconData accountIcon;
  final Color accountAccent;
  final bool showAdvancedOpsButton;
  final bool showOwnerSyncDetails;

  factory _SettingsRoleProfile.fromSession(dynamic session) {
    if (session?.isCashierLike ?? false) {
      return const _SettingsRoleProfile(
        screenTitle: 'Shift settings',
        leadTitle: 'Shift settings',
        leadSubtitle:
            'Keep the day simple here. Check app health, refresh the workspace, and sign out when the shift ends.',
        leadIcon: Icons.settings_rounded,
        leadAccent: Color(0xFF38BDF8),
        workspaceTag: 'SHIFT READY',
        syncPanelTitle: 'App health',
        refreshButtonLabel: 'Refresh app',
        accountPanelTitle: 'Account',
        accountTag: 'FAST EXIT',
        accountIcon: Icons.flash_on_rounded,
        accountAccent: Color(0xFF22C55E),
        showAdvancedOpsButton: false,
        showOwnerSyncDetails: false,
      );
    }

    if (session?.isManager ?? false) {
      return const _SettingsRoleProfile(
        screenTitle: 'Operations settings',
        leadTitle: 'Operations settings',
        leadSubtitle:
            'Use this space for daily store settings and app health. Heavy platform tooling stays out of the way.',
        leadIcon: Icons.settings_applications_rounded,
        leadAccent: Color(0xFF14B8A6),
        workspaceTag: 'STORE READY',
        syncPanelTitle: 'Workspace health',
        refreshButtonLabel: 'Refresh workspace',
        accountPanelTitle: 'Account',
        accountTag: 'DAILY USE',
        accountIcon: Icons.badge_rounded,
        accountAccent: Color(0xFF14B8A6),
        showAdvancedOpsButton: false,
        showOwnerSyncDetails: false,
      );
    }

    return const _SettingsRoleProfile(
      screenTitle: 'Store settings',
      leadTitle: 'Store settings',
      leadSubtitle:
          'Daily controls stay simple here. Advanced recovery, rollout, and technical tooling remain behind the admin-only ops area.',
      leadIcon: Icons.settings_rounded,
      leadAccent: Color(0xFFA78BFA),
      workspaceTag: 'OWNER VIEW',
      syncPanelTitle: 'Workspace health',
      refreshButtonLabel: 'Refresh workspace',
      accountPanelTitle: 'Owner and support',
      accountTag: 'ADMIN PATH',
      accountIcon: Icons.shield_rounded,
      accountAccent: Color(0xFFA78BFA),
      showAdvancedOpsButton: true,
      showOwnerSyncDetails: true,
    );
  }

  String syncLabelFor(MobileSyncStatus syncStatus) {
    return switch (syncStatus) {
      MobileSyncStatus.syncing => 'Refreshing',
      MobileSyncStatus.error => 'Needs attention',
      MobileSyncStatus.offline => 'Offline',
      MobileSyncStatus.idle => 'Stable',
    };
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
                      label,
                      style: theme.textTheme.labelMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.52),
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
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
