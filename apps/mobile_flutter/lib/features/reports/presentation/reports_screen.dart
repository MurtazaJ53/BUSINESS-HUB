import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

/// Sales reports — period totals, collected vs. due, and payment mix.
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  HistoryDateWindow _window = HistoryDateWindow.today;

  @override
  Widget build(BuildContext context) {
    final sales =
        ref
            .watch(
              historySalesProvider(
                HistoryFilter(dateWindow: _window, limit: 1000),
              ),
            )
            .asData
            ?.value ??
        const <RecentSaleSummary>[];

    final gross = sales.fold<double>(0, (s, x) => s + x.total);
    final collected = sales.fold<double>(0, (s, x) => s + x.amountReceived);
    final due = sales.fold<double>(0, (s, x) => s + x.amountDue);
    final receipts = sales.length;
    final avgTicket = receipts == 0 ? 0.0 : gross / receipts;
    final creditCount = sales.where((x) => x.hasOutstandingDue).length;

    final mix = <String, double>{};
    for (final sale in sales) {
      final mode = sale.paymentMode.isEmpty ? 'OTHER' : sale.paymentMode;
      mix[mode] = (mix[mode] ?? 0) + sale.total;
    }
    final mixEntries = mix.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    // P&L: fold sale lines (with per-line cost) + period expenses.
    final reportSales =
        ref.watch(reportSalesProvider(_window)).asData?.value ??
        const <ReportSale>[];
    final periodExpenses =
        ref.watch(reportExpensesProvider(_window)).asData?.value ?? 0.0;
    final pl = computeProfitAndLoss(
      sales: reportSales,
      expenses: periodExpenses,
    );
    // A cashier shouldn't see cost/profit — hide the whole P&L for them.
    final canViewProfit =
        ref.watch(mobileSessionProvider).asData?.value?.canViewCost ?? false;

    return MobileStandaloneScaffold(
      title: 'Reports',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: <Widget>[
          // Period selector
          SizedBox(
            height: 40,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: HistoryDateWindow.values.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final w = HistoryDateWindow.values[i];
                return ChoiceChip(
                  label: Text(w.label),
                  selected: _window == w,
                  onSelected: (_) => setState(() => _window = w),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.push('/day-close'),
              icon: const Icon(Icons.account_balance_wallet_rounded),
              label: const Text('Day close / cash count'),
            ),
          ),
          const SizedBox(height: 18),

          // Headline
          MobilePanel(
            title: 'Sales',
            action: MobileTag(
              label: '$receipts receipt${receipts == 1 ? '' : 's'}',
              icon: Icons.receipt_long_rounded,
              accent: AppPalette.primary,
            ),
            child: Column(
              children: <Widget>[
                _StatRow(
                  label: 'Gross sales',
                  value: formatCurrency(gross),
                  accent: AppPalette.primary,
                  strong: true,
                ),
                const SizedBox(height: 10),
                _StatRow(
                  label: 'Collected',
                  value: formatCurrency(collected),
                  accent: AppPalette.success,
                ),
                const SizedBox(height: 10),
                _StatRow(
                  label: 'Outstanding due',
                  value: formatCurrency(due),
                  accent: due > 0 ? AppPalette.warning : AppPalette.success,
                ),
                const SizedBox(height: 10),
                _StatRow(
                  label: 'Average ticket',
                  value: formatCurrency(avgTicket),
                  accent: AppPalette.info,
                ),
                const SizedBox(height: 10),
                _StatRow(
                  label: 'Credit sales',
                  value: '$creditCount',
                  accent: AppPalette.warning,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Payment mix
          MobilePanel(
            title: 'Payment mix',
            action: const MobileTag(
              label: 'BY MODE',
              icon: Icons.donut_small_rounded,
            ),
            child: mixEntries.isEmpty
                ? const MobileEmptyState(
                    icon: Icons.query_stats_rounded,
                    title: 'No sales in this period',
                    body: 'Pick a wider period or record a sale.',
                  )
                : Column(
                    children: mixEntries
                        .map(
                          (e) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _MixBar(
                              mode: e.key,
                              amount: e.value,
                              fraction: gross <= 0 ? 0 : e.value / gross,
                            ),
                          ),
                        )
                        .toList(growable: false),
                  ),
          ),
          if (canViewProfit) ...<Widget>[
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Profit & loss',
              action: MobileTag(
                label: '${pl.marginPct.toStringAsFixed(0)}% MARGIN',
                icon: Icons.trending_up_rounded,
                accent: pl.netProfit >= 0
                    ? AppPalette.success
                    : AppPalette.error,
              ),
              child: Column(
                children: <Widget>[
                  _StatRow(
                    label: 'Gross sales',
                    value: formatCurrency(pl.grossSales),
                    accent: AppPalette.primary,
                  ),
                  const SizedBox(height: 10),
                  _StatRow(
                    label: '− Cost of goods sold',
                    value: formatCurrency(pl.cogs),
                    accent: AppPalette.warning,
                  ),
                  const SizedBox(height: 10),
                  _StatRow(
                    label: '= Gross profit',
                    value: formatCurrency(pl.grossProfit),
                    accent: AppPalette.info,
                  ),
                  const SizedBox(height: 10),
                  _StatRow(
                    label: '− Expenses',
                    value: formatCurrency(pl.expenses),
                    accent: AppPalette.warning,
                  ),
                  const Divider(height: 22),
                  _StatRow(
                    label: '= Net profit',
                    value: formatCurrency(pl.netProfit),
                    accent: pl.netProfit >= 0
                        ? AppPalette.success
                        : AppPalette.error,
                    strong: true,
                  ),
                  const SizedBox(height: 10),
                  _StatRow(
                    label: 'GST collected',
                    value: formatCurrency(pl.gstCollected),
                    accent: AppPalette.info,
                  ),
                ],
              ),
            ),
          ],
          if (pl.topProducts.isNotEmpty) ...<Widget>[
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Top products',
              action: const MobileTag(
                label: 'BY REVENUE',
                icon: Icons.inventory_2_rounded,
              ),
              child: Column(
                children: <Widget>[
                  for (final p in pl.topProducts)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _StatRow(
                        label: '${p.name}  ·  ${p.quantity} sold',
                        value: formatCurrency(p.revenue),
                        accent: AppPalette.primary,
                      ),
                    ),
                ],
              ),
            ),
          ],
          if (pl.topCustomers.isNotEmpty) ...<Widget>[
            const SizedBox(height: 18),
            MobilePanel(
              title: 'Top customers',
              action: const MobileTag(
                label: 'BY SPEND',
                icon: Icons.people_alt_rounded,
              ),
              child: Column(
                children: <Widget>[
                  for (final c in pl.topCustomers)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _StatRow(
                        label: '${c.name}  ·  ${c.orders} order(s)',
                        value: formatCurrency(c.spend),
                        accent: AppPalette.info,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({
    required this.label,
    required this.value,
    required this.accent,
    this.strong = false,
  });

  final String label;
  final String value;
  final Color accent;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
        ),
        const SizedBox(width: 10),
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colors.textSecondary,
          ),
        ),
        const Spacer(),
        Text(
          value,
          style: (strong ? theme.textTheme.titleLarge : theme.textTheme.titleMedium)
              ?.copyWith(fontWeight: FontWeight.w800, color: strong ? accent : null),
        ),
      ],
    );
  }
}

class _MixBar extends StatelessWidget {
  const _MixBar({
    required this.mode,
    required this.amount,
    required this.fraction,
  });

  final String mode;
  final double amount;
  final double fraction;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(
              mode,
              style: theme.textTheme.labelLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            Text(
              '${formatCurrency(amount)} · ${(fraction * 100).round()}%',
              style: theme.textTheme.bodySmall?.copyWith(
                color: colors.textSecondary,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: LinearProgressIndicator(
            value: fraction.clamp(0, 1),
            minHeight: 8,
            backgroundColor: colors.surfaceStrong,
            valueColor: const AlwaysStoppedAnimation<Color>(AppPalette.primary),
          ),
        ),
      ],
    );
  }
}
