import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
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
    final pulseAsync = ref.watch(workspacePulseProvider);
    final pulse = pulseAsync.asData?.value;
    final sessionsAsync = ref.watch(workspaceAccessSessionsProvider);
    final sessions = sessionsAsync.asData?.value ??
        const <WorkspaceAccessSessionRecord>[];
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final history =
        ref.watch(historyOverviewProvider).asData?.value ??
        HistoryOverview.empty();
    final pending = ref.watch(pendingOutboxCountProvider).asData?.value ?? 0;
    final profile = _SettingsRoleProfile.fromSession(session, shop);

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
                _SettingsRow(
                  label: 'Access focus',
                  value: session?.roleSummary ?? 'Role scope is still loading',
                  icon: Icons.rule_folder_rounded,
                ),
                _SettingsRow(
                  label: 'Plan',
                  value: '${shop.planLabel} plan',
                  icon: Icons.workspace_premium_rounded,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Workspace plan',
            action: MobileTag(
              label: '${shop.planLabel} plan',
              icon: Icons.workspace_premium_rounded,
              accent: const Color(0xFFF59E0B),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  _planTitle(shop),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _planBody(shop),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.70),
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 14),
                _PlanSection(
                  title: _currentPlanSectionTitle(shop),
                  lines: _currentPlanSectionLines(shop),
                ),
                const SizedBox(height: 12),
                _PlanSection(
                  title: _nextPlanSectionTitle(shop),
                  lines: _nextPlanSectionLines(shop),
                ),
                if (session?.isOwnerLike ?? false) ...<Widget>[
                  const SizedBox(height: 12),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final stacked = constraints.maxWidth < 430;
                      final actions = <Widget>[
                        Expanded(
                          child: FilledButton.tonalIcon(
                            onPressed: () {
                              context.push('/settings/plan');
                            },
                            icon: const Icon(Icons.open_in_new_rounded),
                            label: const Text('Open compare'),
                          ),
                        ),
                        Expanded(
                          child: FilledButton.tonalIcon(
                            onPressed: () async {
                              await Clipboard.setData(
                                ClipboardData(
                                  text: _buildPlanSummaryText(shop, session),
                                ),
                              );
                              if (!context.mounted) {
                                return;
                              }
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Plan summary copied.'),
                                ),
                              );
                            },
                            icon: const Icon(Icons.copy_rounded),
                            label: const Text('Copy summary'),
                          ),
                        ),
                        if (shop.normalizedPlanTier != 'pro')
                          Expanded(
                            child: FilledButton.tonalIcon(
                              onPressed: () async {
                                await Clipboard.setData(
                                  ClipboardData(
                                    text: _buildUpgradeBriefText(shop, session),
                                  ),
                                );
                                if (!context.mounted) {
                                  return;
                                }
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Upgrade brief copied.'),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.trending_up_rounded),
                              label: Text(_upgradeButtonLabel(shop)),
                            ),
                          ),
                      ];

                      if (stacked) {
                        return Column(
                          children: actions
                              .expand(
                                (widget) => <Widget>[
                                  widget,
                                  if (widget != actions.last)
                                    const SizedBox(height: 10),
                                ],
                              )
                              .toList(growable: false),
                        );
                      }

                      return Row(
                        children: actions
                            .expand(
                              (widget) => <Widget>[
                                widget,
                                if (widget != actions.last)
                                  const SizedBox(width: 10),
                              ],
                            )
                            .toList(growable: false),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 18),
          if (session?.isOwnerLike ?? false) ...<Widget>[
            MobilePanel(
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    pulse?.headline.title ?? 'Owner/admin attention desk',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    pulse?.headline.body ??
                        'Open the pulse desk to acknowledge, resolve, or reopen the latest workspace tasks and anomaly signals.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.72),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.tonalIcon(
                    onPressed: () {
                      context.push('/settings/pulse');
                    },
                    icon: const Icon(Icons.monitor_heart_rounded),
                    label: const Text('Open pulse desk'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Workspace sessions',
              action: MobileTag(
                label: sessions.isEmpty
                    ? (sessionsAsync.isLoading ? 'Refreshing' : 'No devices')
                    : '${sessions.length} devices',
                icon: sessions.isEmpty
                    ? Icons.smartphone_rounded
                    : Icons.devices_rounded,
                accent: sessions.any((item) => item.isRisky || item.wipeRequested)
                    ? const Color(0xFFFB7185)
                    : const Color(0xFF38BDF8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    sessions.isEmpty
                        ? 'Review mobile device access, risky trust posture, and remote wipe actions from one owner/admin desk.'
                        : '${sessions.where((item) => item.isTrusted && !item.wipeRequested).length} trusted, ${sessions.where((item) => item.needsReview).length} review, and ${sessions.where((item) => item.isRisky || item.wipeRequested).length} risky or wipe-pending device sessions are visible right now.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.72),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.tonalIcon(
                    onPressed: () {
                      context.push('/settings/sessions');
                    },
                    icon: const Icon(Icons.devices_rounded),
                    label: const Text('Open sessions'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Security',
              action: MobileTag(
                label: 'Owner/admin gate',
                icon: Icons.verified_user_rounded,
                accent: const Color(0xFF38BDF8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Protect Workspace plan, Advanced ops, and other sensitive control surfaces with an authenticator app.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.72),
                      height: 1.45,
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton.tonalIcon(
                    onPressed: () {
                      context.push('/settings/security');
                    },
                    icon: const Icon(Icons.security_rounded),
                    label: const Text('Open security'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
          ],
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
                        .expand(
                          (widget) => <Widget>[
                            widget,
                            if (widget != actions.last)
                              const SizedBox(height: 10),
                          ],
                        )
                        .toList(growable: false),
                  );
                }

                return Row(
                  children: actions
                      .expand(
                        (widget) => <Widget>[
                          widget,
                          if (widget != actions.last) const SizedBox(width: 10),
                        ],
                      )
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

  factory _SettingsRoleProfile.fromSession(dynamic session, ShopInfo shop) {
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

    return _SettingsRoleProfile(
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
      showAdvancedOpsButton: shop.supportsAdvancedOps,
      showOwnerSyncDetails: shop.supportsAdvancedOps,
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

String _planTitle(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Starter keeps this workspace calm';
    case 'pro':
      return 'Pro unlocks the full curated stack';
    default:
      return 'Growth adds daily store operations';
  }
}

String _planBody(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'This workspace focuses on selling, stock, customers, and receipts. Heavier operations stay hidden until the shop actually needs them.';
    case 'pro':
      return 'This workspace can open deeper insights and stronger admin support tools while still keeping raw ERP complexity out of normal daily use.';
    default:
      return 'This workspace includes practical store operations like expenses and attendance without turning the product into a crowded ERP shell.';
  }
}

String _currentPlanSectionTitle(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Starter now';
    case 'pro':
      return 'Pro now';
    default:
      return 'Growth now';
  }
}

List<String> _currentPlanSectionLines(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return const <String>[
        'POS and barcode selling',
        'Inventory and low-stock watch',
        'Customer balances and receipt history',
      ];
    case 'pro':
      return const <String>[
        'Finance and advanced reporting',
        'Advanced owner and admin controls',
        'The full curated Business Hub stack',
      ];
    default:
      return const <String>[
        'Everything in Starter',
        'Expenses and attendance',
        'Supplier-ready store operations',
      ];
  }
}

String _nextPlanSectionTitle(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Growth next';
    case 'pro':
      return 'Keep it curated';
    default:
      return 'Pro next';
  }
}

List<String> _nextPlanSectionLines(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return const <String>[
        'Expenses and attendance',
        'Light supplier workflows',
        'More operational control without ERP clutter',
      ];
    case 'pro':
      return const <String>[
        'Limit deep tools to owners and admins',
        'Keep daily screens simple for staff',
        'Avoid exposing raw ERP complexity',
      ];
    default:
      return const <String>[
        'Finance and owner summary rollups',
        'Advanced customer and sales insight',
        'Stronger admin and support controls',
      ];
  }
}

String _upgradeButtonLabel(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Copy Growth brief';
    case 'growth':
      return 'Copy Pro brief';
    default:
      return 'Copy upgrade brief';
  }
}

String _nextPlanLabel(ShopInfo shop) {
  switch (shop.normalizedPlanTier) {
    case 'starter':
      return 'Growth';
    case 'growth':
      return 'Pro';
    default:
      return 'Pro';
  }
}

String _buildPlanSummaryText(ShopInfo shop, MobileSession? session) {
  final buffer = StringBuffer()
    ..writeln('Business Hub workspace plan summary')
    ..writeln('Workspace: ${shop.name}')
    ..writeln('Current plan: ${shop.planLabel}')
    ..writeln('Operator role: ${session?.displayRoleLabel ?? 'UNKNOWN'}')
    ..writeln()
    ..writeln('${_currentPlanSectionTitle(shop)}:');

  for (final line in _currentPlanSectionLines(shop)) {
    buffer.writeln('- $line');
  }

  buffer
    ..writeln()
    ..writeln('${_nextPlanSectionTitle(shop)}:');

  for (final line in _nextPlanSectionLines(shop)) {
    buffer.writeln('- $line');
  }

  return buffer.toString().trimRight();
}

String _buildUpgradeBriefText(ShopInfo shop, MobileSession? session) {
  final buffer = StringBuffer()
    ..writeln('Business Hub workspace upgrade brief')
    ..writeln('Workspace: ${shop.name}')
    ..writeln('Current plan: ${shop.planLabel}')
    ..writeln('Requested next plan: ${_nextPlanLabel(shop)}')
    ..writeln('Operator role: ${session?.displayRoleLabel ?? 'UNKNOWN'}')
    ..writeln()
    ..writeln('${_currentPlanSectionTitle(shop)}:');

  for (final line in _currentPlanSectionLines(shop)) {
    buffer.writeln('- $line');
  }

  buffer
    ..writeln()
    ..writeln('${_nextPlanSectionTitle(shop)}:');

  for (final line in _nextPlanSectionLines(shop)) {
    buffer.writeln('- $line');
  }

  return buffer.toString().trimRight();
}

class _PlanSection extends StatelessWidget {
  const _PlanSection({required this.title, required this.lines});

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
