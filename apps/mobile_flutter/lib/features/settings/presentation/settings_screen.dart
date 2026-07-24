import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/runtime/app_runtime_info.dart';
import '../../../core/runtime/mobile_runtime_config.dart';
import 'shop_switcher_screen.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/theme/app_theme.dart';
import '../../shell/presentation/mobile_surface.dart';

/// Clean, shop-owner-first settings.
///
/// Day-to-day controls only. Internal/ops tooling (pulse, device sessions,
/// advanced ops) lives behind the single "Admin tools" entry.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final pending = ref.watch(pendingOutboxCountProvider).asData?.value ?? 0;
    final version = ref.watch(appRuntimeInfoProvider).asData?.value.versionLabel;
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);

    final owner = session?.isOwnerLike ?? false;

    return MobileStandaloneScaffold(
      title: 'Settings',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: <Widget>[
          // Shop identity
          MobilePanel(
            title: 'Shop',
            action: MobileTag(
              label: '${shop.planLabel} plan',
              icon: Icons.workspace_premium_rounded,
              accent: AppPalette.primary,
            ),
            child: Column(
              children: <Widget>[
                _InfoRow(
                  icon: Icons.storefront_rounded,
                  label: 'Shop',
                  value: shop.name,
                ),
                _InfoRow(
                  icon: Icons.person_rounded,
                  label: 'Signed in',
                  value: session != null && session.email.isNotEmpty
                      ? session.email
                      : 'Local operator',
                ),
                _InfoRow(
                  icon: Icons.badge_rounded,
                  label: 'Role',
                  value: session?.displayRoleLabel ?? 'GUEST',
                  last: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          // Manage
          const _SectionLabel('Manage'),
          if (owner)
            MobileListTile(
              title: 'Business details',
              subtitle: 'Name, receipt footer, currency',
              leadingIcon: Icons.storefront_rounded,
              onTap: () => context.push('/settings/business'),
            ),
          if (owner)
            MobileListTile(
              title: 'Staff & PINs',
              subtitle: 'Accounts, roles and personal PINs',
              leadingIcon: Icons.badge_rounded,
              onTap: () => context.push('/settings/staff'),
            ),
          if (owner)
            MobileListTile(
              title: 'Team',
              subtitle: 'Workspace members (cloud)',
              leadingIcon: Icons.groups_rounded,
              onTap: () => context.push('/settings/team'),
            ),
          if (MobileRuntimeConfig.backendAuthMode == 'jwt')
            MobileListTile(
              title: 'Switch shop',
              subtitle: 'Change the active workspace',
              leadingIcon: Icons.swap_horiz_rounded,
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const ShopSwitcherScreen(),
                ),
              ),
            ),
          if (shop.supportsAttendance)
            MobileListTile(
              title: 'Attendance',
              subtitle: 'Clock-in and shift records',
              leadingIcon: Icons.fact_check_rounded,
              onTap: () => context.push('/settings/attendance'),
            ),
          if (shop.supportsExpenses)
            MobileListTile(
              title: 'Expenses',
              subtitle: 'Track shop spending',
              leadingIcon: Icons.payments_rounded,
              onTap: () => context.push('/settings/expenses'),
            ),
          MobileListTile(
            title: 'Suppliers & purchases',
            subtitle: 'Stock buying and supplier dues',
            leadingIcon: Icons.local_shipping_rounded,
            onTap: () => context.push('/settings/purchases'),
          ),
          MobileListTile(
            title: 'Plan',
            subtitle: '${shop.planLabel} plan',
            leadingIcon: Icons.workspace_premium_rounded,
            onTap: () => context.push('/settings/plan'),
          ),
          MobileListTile(
            title: 'Backup & restore',
            subtitle: 'Protect your books from data loss',
            leadingIcon: Icons.backup_rounded,
            onTap: () => context.push('/settings/backup'),
          ),
          if (owner)
            MobileListTile(
              title: 'Import data',
              subtitle: 'Migrate from Zobaze (.xlsx)',
              leadingIcon: Icons.swap_horiz_rounded,
              onTap: () => context.push('/settings/import'),
            ),
          MobileListTile(
            title: 'Change PIN',
            subtitle: 'Update your unlock PIN',
            leadingIcon: Icons.pin_rounded,
            onTap: () => _changePinDialog(context, ref),
          ),
          if (owner)
            MobileListTile(
              title: 'Security',
              subtitle: 'App lock and MFA',
              leadingIcon: Icons.security_rounded,
              onTap: () => context.push('/settings/security'),
            ),

          // Sync (only surfaces when there is something to do)
          if (pending > 0) ...<Widget>[
            const SizedBox(height: 22),
            MobilePanel(
              title: 'Sync',
              action: MobileTag(
                label: '$pending queued',
                icon: Icons.cloud_upload_rounded,
                accent: AppPalette.warning,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Text(
                    '$pending receipt${pending == 1 ? '' : 's'} waiting to sync.',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  FilledButton.tonalIcon(
                    onPressed: () async {
                      final result =
                          await syncCoordinator.flushCommerceOutbox();
                      if (!context.mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            result.message ?? 'Retrying queued receipts.',
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.cloud_upload_rounded),
                    label: const Text('Retry sync'),
                  ),
                ],
              ),
            ),
          ],

          // Admin tools (owners only)
          if (owner && shop.supportsAdvancedOps) ...<Widget>[
            const SizedBox(height: 22),
            const _SectionLabel('Advanced'),
            MobileListTile(
              title: 'Admin tools',
              subtitle: 'Pulse, devices and operations',
              leadingIcon: Icons.tune_rounded,
              accent: AppPalette.textTertiary,
              onTap: () => context.push('/settings/admin'),
            ),
          ],

          const SizedBox(height: 28),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await ref.read(mobileSessionProvider.notifier).logout();
                if (context.mounted) context.go('/');
              },
              style: OutlinedButton.styleFrom(
                foregroundColor: AppPalette.error,
                side: const BorderSide(color: AppPalette.error, width: 1),
              ),
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign out'),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'Business Hub${version == null ? '' : ' · $version'}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: AppPalette.textTertiary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

Future<void> _changePinDialog(BuildContext context, WidgetRef ref) async {
  final current = TextEditingController();
  final next = TextEditingController();
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      title: const Text('Change PIN'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          TextField(
            controller: current,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            decoration: const InputDecoration(
              labelText: 'Current PIN',
              counterText: '',
            ),
          ),
          TextField(
            controller: next,
            obscureText: true,
            keyboardType: TextInputType.number,
            maxLength: 4,
            decoration: const InputDecoration(
              labelText: 'New PIN',
              counterText: '',
            ),
          ),
        ],
      ),
      actions: <Widget>[
        TextButton(
          onPressed: () => Navigator.pop(dialogContext, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(dialogContext, true),
          child: const Text('Save'),
        ),
      ],
    ),
  );

  if (confirmed == true) {
    if (next.text.trim().length < 4) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('New PIN must be 4 digits.')),
        );
      }
    } else {
      final changed = await ref
          .read(mobileSessionProvider.notifier)
          .changePin(current.text.trim(), next.text.trim());
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              changed ? 'PIN updated.' : 'Current PIN is incorrect.',
            ),
          ),
        );
      }
    }
  }
  current.dispose();
  next.dispose();
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 12),
      child: Text(
        label.toUpperCase(),
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
          color: AppPalette.textTertiary,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.last = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool last;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: last ? 0 : 14),
      child: Row(
        children: <Widget>[
          Icon(icon, size: 20, color: AppPalette.textTertiary),
          const SizedBox(width: 12),
          Text(
            label,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: AppPalette.textTertiary,
            ),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
