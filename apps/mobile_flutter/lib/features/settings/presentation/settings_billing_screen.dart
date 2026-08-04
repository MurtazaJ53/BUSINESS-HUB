import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

/// Subscription state + plan catalogue, straight from the server so the app
/// never has to hardcode prices.
final subscriptionProvider =
    FutureProvider.autoDispose<Map<String, dynamic>?>((ref) async {
  final session = ref.watch(mobileSessionProvider).asData?.value;
  if (session == null || !session.hasShop) return null;
  try {
    return await ref
        .read(backendApiClientProvider)
        .fetchSubscription(user: session.user, shopId: session.shopId!);
  } catch (_) {
    return null;
  }
});

class SettingsBillingScreen extends ConsumerStatefulWidget {
  const SettingsBillingScreen({super.key});

  @override
  ConsumerState<SettingsBillingScreen> createState() =>
      _SettingsBillingScreenState();
}

class _SettingsBillingScreenState extends ConsumerState<SettingsBillingScreen> {
  String? _busyPeriod;
  bool _refreshing = false;

  Future<void> _refresh() async {
    final session = ref.read(mobileSessionProvider).asData?.value;
    if (session == null || !session.hasShop) return;
    setState(() => _refreshing = true);
    try {
      // Ask the server to re-evaluate first, so a just-completed payment is
      // reflected without waiting for anything to expire.
      await ref
          .read(backendApiClientProvider)
          .refreshSubscription(user: session.user, shopId: session.shopId!);
      ref.invalidate(subscriptionProvider);
      // The shop profile carries the plan tier that gates the UI.
      ref.invalidate(shopInfoProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Plan status refreshed.')),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not refresh: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _refreshing = false);
    }
  }

  Future<void> _startCheckout(String period, String label, num amount) async {
    final session = ref.read(mobileSessionProvider).asData?.value;
    if (session == null || !session.hasShop) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Pay for $label'),
        content: Text(
          'You will be taken to a secure payment page for '
          '${formatCurrency(amount.toDouble())}.\n\n'
          'Your plan activates as soon as the payment is confirmed. If it '
          'does not appear right away, come back here and tap Refresh.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busyPeriod = period);
    try {
      final result = await ref
          .read(backendApiClientProvider)
          .startSubscriptionCheckout(
            user: session.user,
            shopId: session.shopId!,
            billingPeriod: period,
          );
      final url = (result['payment_url'] ?? '').toString();
      if (url.isEmpty) throw Exception('No payment link was returned.');
      final launched = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
      if (!launched) throw Exception('Could not open the payment page.');
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_friendlyError(error)),
            backgroundColor: AppPalette.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busyPeriod = null);
    }
  }

  String _friendlyError(Object error) {
    final text = error.toString();
    if (text.contains('503') || text.toLowerCase().contains('not configured')) {
      return 'Online payment is not switched on yet. Please contact support to '
          'activate your plan.';
    }
    return 'Payment could not be started: $text';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final async = ref.watch(subscriptionProvider);
    final data = async.asData?.value;
    final subscription =
        (data?['subscription'] as Map?)?.cast<String, dynamic>() ??
            const <String, dynamic>{};
    final plans = (data?['plans'] as List?) ?? const <dynamic>[];
    final paymentsEnabled = data?['payments_enabled'] == true;

    final status = (subscription['status'] ?? '').toString();
    final isTrial = subscription['is_trial'] == true;
    final hasAccess = subscription['has_paid_access'] == true;
    final daysLeft = (subscription['days_remaining'] as num?)?.toInt() ?? 0;

    return MobileStandaloneScaffold(
      title: 'Plan & billing',
      child: async.isLoading
          ? const Center(child: Padding(
              padding: EdgeInsets.all(48),
              child: CircularProgressIndicator(),
            ))
          : ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
              children: <Widget>[
                if (data == null)
                  const MobilePanel(
                    title: 'Plan unavailable',
                    child: MobileEmptyState(
                      icon: Icons.cloud_off_rounded,
                      title: 'Could not load your plan',
                      body:
                          'Check your connection and pull to refresh. Your shop '
                          'keeps working offline in the meantime.',
                    ),
                  )
                else ...<Widget>[
                  _StatusCard(
                    status: status,
                    isTrial: isTrial,
                    hasAccess: hasAccess,
                    daysLeft: daysLeft,
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: 46,
                    child: OutlinedButton.icon(
                      onPressed: _refreshing ? null : _refresh,
                      icon: _refreshing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.refresh_rounded),
                      label: Text(
                        _refreshing ? 'Checking...' : 'I have paid - Refresh',
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    isTrial || !hasAccess
                        ? 'CHOOSE A PLAN'
                        : 'EXTEND YOUR PLAN',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: colors.textTertiary,
                    ),
                  ),
                  const SizedBox(height: 10),
                  for (final raw in plans)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _PlanOptionCard(
                        option: (raw as Map).cast<String, dynamic>(),
                        busy: _busyPeriod ==
                            (raw['period'] ?? '').toString(),
                        anyBusy: _busyPeriod != null,
                        onPay: () => _startCheckout(
                          (raw['period'] ?? '').toString(),
                          (raw['label'] ?? '').toString(),
                          (raw['amount'] as num?) ?? 0,
                        ),
                      ),
                    ),
                  if (!paymentsEnabled) ...<Widget>[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppPalette.warning.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: AppPalette.warning.withValues(alpha: 0.35),
                        ),
                      ),
                      child: Row(
                        children: <Widget>[
                          const Icon(
                            Icons.info_outline_rounded,
                            color: AppPalette.warning,
                            size: 20,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              'Online payment is being set up. Contact support '
                              'to activate a plan in the meantime.',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    'Every plan includes the full app: billing, inventory, '
                    'khata, staff, expenses, suppliers, purchases, reports and '
                    'cloud backup. Your data is never deleted if a plan lapses '
                    '- paid features simply lock until you renew.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.textSecondary,
                      height: 1.5,
                    ),
                  ),
                ],
              ],
            ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.status,
    required this.isTrial,
    required this.hasAccess,
    required this.daysLeft,
  });

  final String status;
  final bool isTrial;
  final bool hasAccess;
  final int daysLeft;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final (String title, String body, Color accent, IconData icon) = switch (
      status
    ) {
      'trialing' => (
          'Free trial - $daysLeft ${daysLeft == 1 ? 'day' : 'days'} left',
          'You have the complete Pro app during the trial. Pick a plan before '
              'it ends to keep everything switched on.',
          AppPalette.primary,
          Icons.rocket_launch_rounded,
        ),
      'active' => (
          'Pro plan active',
          '$daysLeft ${daysLeft == 1 ? 'day' : 'days'} remaining. Renew any '
              'time - extra days are added on top, never lost.',
          AppPalette.success,
          Icons.verified_rounded,
        ),
      'past_due' => (
          'Payment due',
          'Your plan has ended but you still have a short grace period. Renew '
              'now to avoid losing the paid features.',
          AppPalette.warning,
          Icons.schedule_rounded,
        ),
      'cancelled' => (
          'Plan cancelled',
          'Paid features are locked. Your data is safe - renew any time to '
              'switch everything back on.',
          AppPalette.error,
          Icons.cancel_rounded,
        ),
      _ => (
          'Plan expired',
          'Paid features are locked. Your data is safe and billing still '
              'works - choose a plan to unlock everything again.',
          AppPalette.error,
          Icons.lock_rounded,
        ),
    };

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: accent.withValues(alpha: 0.32)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(icon, color: accent),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: colors.textSecondary,
              height: 1.45,
            ),
          ),
        ],
      ),
    );
  }
}

class _PlanOptionCard extends StatelessWidget {
  const _PlanOptionCard({
    required this.option,
    required this.busy,
    required this.anyBusy,
    required this.onPay,
  });

  final Map<String, dynamic> option;
  final bool busy;
  final bool anyBusy;
  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final label = (option['label'] ?? '').toString();
    final amount = ((option['amount'] as num?) ?? 0).toDouble();
    final perMonth = ((option['effective_monthly'] as num?) ?? 0).toDouble();
    final savings = ((option['savings_percent'] as num?) ?? 0).toInt();
    final isBest = savings >= 8;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isBest
              ? AppPalette.success.withValues(alpha: 0.55)
              : colors.borderSoft,
          width: isBest ? 1.6 : 1,
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Text(
                      label,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (savings > 0) ...<Widget>[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppPalette.success.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'SAVE $savings%',
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: AppPalette.success,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  formatCurrency(amount),
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: AppPalette.primary,
                  ),
                ),
                Text(
                  '${formatCurrency(perMonth)} / month',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.textTertiary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          FilledButton(
            onPressed: anyBusy ? null : onPay,
            child: busy
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text('Pay'),
          ),
        ],
      ),
    );
  }
}
