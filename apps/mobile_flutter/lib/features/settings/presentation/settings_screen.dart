import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/runtime/app_runtime_info.dart';
import '../../../core/runtime/pilot_diagnostics_snapshot.dart';
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
    final domainStatesStream = shopRepository.watchTrackedDomainStates(
      const <String>['inventory', 'customers', 'sales', 'payments'],
    );
    final pendingOutboxStream = salesRepository.watchPendingOutboxCount();

    return StreamBuilder<ShopInfo>(
      stream: shopStream,
      builder: (context, shopSnapshot) {
        final shop = shopSnapshot.data ?? ShopInfo.fallback();
        return ListView(
          padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
          children: <Widget>[
            MobileHeroBanner(
              eyebrow: 'System config',
              title: 'Mobile operating posture.',
              subtitle:
                  'This screen shows which backend surface the mobile app trusts today, which operator is signed in, and how close the workspace is to the fully migrated platform.',
              accent: const Color(0xFFA78BFA),
              trailing: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  MobileTag(
                    label: session?.role?.toUpperCase() ?? 'GUEST',
                    icon: Icons.badge_rounded,
                    accent: const Color(0xFFA78BFA),
                  ),
                  const SizedBox(height: 10),
                  MobileTag(
                    label: syncStatus == MobileSyncStatus.syncing
                        ? 'Syncing config'
                        : 'Config stable',
                    icon: syncStatus == MobileSyncStatus.syncing
                        ? Icons.sync_rounded
                        : Icons.verified_rounded,
                    accent: syncStatus == MobileSyncStatus.error
                        ? const Color(0xFFFB7185)
                        : const Color(0xFF22C55E),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Workspace identity',
              action: MobileTag(
                label:
                    session != null &&
                        (session.isAdmin || session.isElevatedAdmin)
                    ? 'ADMIN EDIT'
                    : 'VIEW ONLY',
                icon:
                    session != null &&
                        (session.isAdmin || session.isElevatedAdmin)
                    ? Icons.edit_rounded
                    : Icons.lock_outline_rounded,
                accent:
                    session != null &&
                        (session.isAdmin || session.isElevatedAdmin)
                    ? const Color(0xFF14B8A6)
                    : const Color(0xFFA78BFA),
              ),
              child: Column(
                children: <Widget>[
                  _SettingsRow(
                    label: 'Workspace',
                    value: shop.name,
                    icon: Icons.storefront_rounded,
                  ),
                  _SettingsRow(
                    label: 'Tagline',
                    value: shop.tagline,
                    icon: Icons.auto_awesome_rounded,
                  ),
                  _SettingsRow(
                    label: 'Operator',
                    value: session != null && session.email.isNotEmpty
                        ? session.email
                        : 'Not signed in',
                    icon: Icons.person_rounded,
                  ),
                  _SettingsRow(
                    label: 'Shop ID',
                    value: session?.shopId ?? 'No workspace bound',
                    icon: Icons.key_rounded,
                  ),
                  _SettingsRow(
                    label: 'Backend API',
                    value: backendApiClient.baseUrl,
                    icon: Icons.cloud_outlined,
                  ),
                  if (session != null &&
                      (session.isAdmin || session.isElevatedAdmin)) ...<Widget>[
                    const SizedBox(height: 6),
                    FilledButton.tonalIcon(
                      onPressed: () async {
                        final changed = await _showWorkspaceSettingsDialog(
                          context,
                          currentShop: shop,
                          session: session,
                          syncCoordinator: syncCoordinator,
                        );
                        if (changed != true || !context.mounted) {
                          return;
                        }
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text(
                              'Workspace settings saved and queued to the live shop document.',
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.edit_note_rounded),
                      label: const Text('Edit workspace settings'),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Build identity',
              action: MobileTag(
                label: runtimeInfoAsync.isLoading ? 'Loading' : 'Runtime',
                icon: Icons.verified_user_rounded,
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
                      icon: Icons.new_releases_rounded,
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
                  title: 'Loading runtime metadata',
                  body:
                      'The mobile shell is resolving package version, build number, and release channel.',
                ),
                error: (error, _) => MobileEmptyState(
                  icon: Icons.error_outline_rounded,
                  title: 'Runtime metadata unavailable',
                  body: error.toString(),
                ),
              ),
            ),
            const SizedBox(height: 18),
            StreamBuilder<int>(
              stream: pendingOutboxStream,
              builder: (context, outboxSnapshot) {
                final pending = outboxSnapshot.data ?? 0;
                return StreamBuilder<HistoryOverview>(
                  stream: historyStream,
                  builder: (context, historySnapshot) {
                    final history =
                        historySnapshot.data ?? HistoryOverview.empty();
                    return MobilePanel(
                      title: 'Mobile runtime',
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
                            label: 'Queued commerce commands',
                            value: '$pending',
                            icon: Icons.outbox_rounded,
                          ),
                          _SettingsRow(
                            label: 'Queued receipt value',
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
                          _SettingsRow(
                            label: 'Operator role',
                            value: session?.role?.toUpperCase() ?? 'UNKNOWN',
                            icon: Icons.admin_panel_settings_rounded,
                          ),
                          _SettingsRow(
                            label: 'Cost visibility',
                            value: session?.canViewCost == true
                                ? 'Enabled'
                                : 'Restricted',
                            icon: Icons.visibility_rounded,
                          ),
                          const SizedBox(height: 6),
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final stacked = constraints.maxWidth < 430;
                              final buttons = <Widget>[
                                Expanded(
                                  child: FilledButton.tonalIcon(
                                    onPressed: () async {
                                      await syncCoordinator.refresh();
                                      if (!context.mounted) {
                                        return;
                                      }
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Workspace refresh requested.',
                                          ),
                                        ),
                                      );
                                    },
                                    icon: const Icon(Icons.refresh_rounded),
                                    label: const Text('Refresh workspace'),
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
                                            ScaffoldMessenger.of(
                                              context,
                                            ).showSnackBar(
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
                                    label: const Text('Flush outbox'),
                                  ),
                                ),
                              ];

                              if (stacked) {
                                return Column(
                                  children: <Widget>[
                                    buttons[0],
                                    const SizedBox(height: 10),
                                    buttons[1],
                                  ],
                                );
                              }

                              return Row(
                                children: <Widget>[
                                  buttons[0],
                                  const SizedBox(width: 10),
                                  buttons[1],
                                ],
                              );
                            },
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
            ),
            const SizedBox(height: 18),
            StreamBuilder<List<DomainControlState>>(
              stream: domainStatesStream,
              builder: (context, snapshot) {
                final states =
                    snapshot.data ??
                    <DomainControlState>[
                      DomainControlState.legacy('inventory'),
                      DomainControlState.legacy('customers'),
                      DomainControlState.legacy('sales'),
                      DomainControlState.legacy('payments'),
                    ];

                return MobilePanel(
                  title: 'Domain cutover map',
                  action: MobileTag(
                    label:
                        '${states.where((state) => state.isPostgresPrimary).length} primary',
                    icon: Icons.schema_rounded,
                    accent: const Color(0xFF38BDF8),
                  ),
                  child: Column(
                    children: states
                        .map(
                          (state) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _DomainSettingsRow(state: state),
                          ),
                        )
                        .toList(growable: false),
                  ),
                );
              },
            ),
            const SizedBox(height: 18),
            StreamBuilder<List<DomainControlState>>(
              stream: domainStatesStream,
              builder: (context, domainSnapshot) {
                final domainStates =
                    domainSnapshot.data ??
                    <DomainControlState>[
                      DomainControlState.legacy('inventory'),
                      DomainControlState.legacy('customers'),
                      DomainControlState.legacy('sales'),
                      DomainControlState.legacy('payments'),
                    ];
                return StreamBuilder<int>(
                  stream: pendingOutboxStream,
                  builder: (context, outboxSnapshot) {
                    final pending = outboxSnapshot.data ?? 0;
                    return StreamBuilder<HistoryOverview>(
                      stream: historyStream,
                      builder: (context, historySnapshot) {
                        final history =
                            historySnapshot.data ?? HistoryOverview.empty();
                        final runtimeInfo = runtimeInfoAsync.asData?.value;
                        final snapshot = runtimeInfo == null
                            ? null
                            : PilotDiagnosticsSnapshot(
                                runtimeInfo: runtimeInfo,
                                shop: shop,
                                session: session,
                                backendBaseUrl: backendApiClient.baseUrl,
                                syncStatus: syncStatus,
                                historyOverview: history,
                                pendingOutboxCount: pending,
                                domainStates: domainStates,
                              );

                        return MobilePanel(
                          title: 'Pilot handoff snapshot',
                          action: MobileTag(
                            label: snapshot == null ? 'Loading' : 'Copy ready',
                            icon: snapshot == null
                                ? Icons.sync_rounded
                                : Icons.assignment_turned_in_rounded,
                            accent: snapshot == null
                                ? const Color(0xFFF59E0B)
                                : const Color(0xFF22C55E),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(
                                'Use this before a pilot handoff or floor smoke run. It captures the installed build identity, workspace, queue health, and domain posture in one copyable block for release notes, QA, or operator chat.',
                                style: Theme.of(
                                  context,
                                ).textTheme.bodySmall?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.68),
                                  fontWeight: FontWeight.w600,
                                  height: 1.45,
                                ),
                              ),
                              const SizedBox(height: 14),
                              _SettingsRow(
                                label: 'Release fingerprint',
                                value: runtimeInfo?.releaseFingerprint ??
                                    'Loading runtime metadata',
                                icon: Icons.flag_rounded,
                              ),
                              _SettingsRow(
                                label: 'Pilot posture',
                                value: snapshot?.primaryDomainCountLabel ??
                                    'Resolving domain states',
                                icon: Icons.fact_check_rounded,
                              ),
                              _SettingsRow(
                                label: 'Last receipt sync',
                                value: snapshot?.lastReceiptSyncLabel ??
                                    'Unknown',
                                icon: Icons.history_toggle_off_rounded,
                              ),
                              FilledButton.tonalIcon(
                                onPressed: snapshot == null
                                    ? null
                                    : () async {
                                        await Clipboard.setData(
                                          ClipboardData(
                                            text: snapshot.toMultilineText(),
                                          ),
                                        );
                                        if (!context.mounted) {
                                          return;
                                        }
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Pilot launch snapshot copied. Paste it into the rollout thread or QA sheet.',
                                            ),
                                          ),
                                        );
                                      },
                                icon: const Icon(Icons.copy_all_rounded),
                                label: const Text('Copy pilot snapshot'),
                              ),
                            ],
                          ),
                        );
                      },
                    );
                  },
                );
              },
            ),
          ],
        );
      },
    );
  }

  Future<bool?> _showWorkspaceSettingsDialog(
    BuildContext context, {
    required ShopInfo currentShop,
    required MobileSession session,
    required MobileSyncCoordinator syncCoordinator,
  }) async {
    final taglineController = TextEditingController(text: currentShop.tagline);
    final footerController = TextEditingController(text: currentShop.footer);
    final phoneController = TextEditingController(text: currentShop.phone);
    var saving = false;

    try {
      return await showDialog<bool>(
        context: context,
        builder: (dialogContext) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: const Text('Edit workspace settings'),
                content: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'These values update the local workspace immediately and then sync back to the live shop document for ${session.shopId}.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.66),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: taglineController,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'Tagline'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: footerController,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Receipt footer',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(
                          labelText: 'Workspace phone',
                        ),
                      ),
                    ],
                  ),
                ),
                actions: <Widget>[
                  TextButton(
                    onPressed: saving
                        ? null
                        : () => Navigator.of(dialogContext).pop(false),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    onPressed: saving
                        ? null
                        : () async {
                            final tagline = taglineController.text.trim();
                            final footer = footerController.text.trim();
                            final phone = phoneController.text.trim();
                            if (tagline.isEmpty || footer.isEmpty) {
                              ScaffoldMessenger.of(dialogContext).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Tagline and receipt footer are required.',
                                  ),
                                ),
                              );
                              return;
                            }
                            setDialogState(() {
                              saving = true;
                            });
                            try {
                              await syncCoordinator.updateWorkspaceSettings(
                                currentShop: currentShop,
                                tagline: tagline,
                                footer: footer,
                                phone: phone,
                              );
                              if (dialogContext.mounted) {
                                Navigator.of(dialogContext).pop(true);
                              }
                            } catch (error) {
                              if (dialogContext.mounted) {
                                ScaffoldMessenger.of(
                                  dialogContext,
                                ).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Workspace save failed: $error',
                                    ),
                                  ),
                                );
                              }
                              setDialogState(() {
                                saving = false;
                              });
                            }
                          },
                    child: saving
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save'),
                  ),
                ],
              );
            },
          );
        },
      );
    } finally {
      taglineController.dispose();
      footerController.dispose();
      phoneController.dispose();
    }
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
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFA78BFA).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(icon, color: const Color(0xFFA78BFA)),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label.toUpperCase(),
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.5),
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      value,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
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

class _DomainSettingsRow extends StatelessWidget {
  const _DomainSettingsRow({required this.state});

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
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    state.domain.toUpperCase(),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                MobileTag(
                  label: state.postureLabel.toUpperCase(),
                  icon: state.isPostgresPrimary
                      ? Icons.verified_rounded
                      : Icons.swap_horiz_rounded,
                  accent: tone,
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              state.pilotSignoffSummary ??
                  'Write master: ${state.writeMaster} | epoch ${state.currentEpoch}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.62),
                fontWeight: FontWeight.w600,
                height: 1.45,
              ),
            ),
            if (state.pilotRecommendedAction?.isNotEmpty == true) ...<Widget>[
              const SizedBox(height: 10),
              Text(
                'Next action: ${state.pilotRecommendedAction}',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: tone,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
