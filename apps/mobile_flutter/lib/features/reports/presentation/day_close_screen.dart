import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

/// End-of-day close: today's takings, per-mode totals, and a cash count with
/// expected-vs-counted variance.
class DayCloseScreen extends ConsumerStatefulWidget {
  const DayCloseScreen({super.key});

  @override
  ConsumerState<DayCloseScreen> createState() => _DayCloseScreenState();
}

class _DayCloseScreenState extends ConsumerState<DayCloseScreen> {
  final TextEditingController _counted = TextEditingController();

  @override
  void dispose() {
    _counted.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final sales =
        ref
            .watch(
              historySalesProvider(
                const HistoryFilter(
                  dateWindow: HistoryDateWindow.today,
                  limit: 2000,
                ),
              ),
            )
            .asData
            ?.value ??
        const <RecentSaleSummary>[];

    final gross = sales.fold<double>(0, (s, x) => s + x.total);
    final collected = sales.fold<double>(0, (s, x) => s + x.amountReceived);
    final due = sales.fold<double>(0, (s, x) => s + x.amountDue);

    final byMode = <String, double>{};
    for (final sale in sales) {
      final mode = sale.paymentMode.isEmpty ? 'OTHER' : sale.paymentMode;
      byMode[mode] = (byMode[mode] ?? 0) + sale.amountReceived;
    }
    final expectedCash = byMode['CASH'] ?? 0;
    final counted = double.tryParse(_counted.text.trim());
    final variance = counted == null ? null : counted - expectedCash;

    final modeEntries = byMode.entries.toList()
      ..sort((a, b) => b.value.compareTo(a.value));

    return MobileStandaloneScaffold(
      title: 'Day close',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
        children: <Widget>[
          MobilePanel(
            title: 'Today',
            action: MobileTag(
              label: '${sales.length} sales',
              icon: Icons.today_rounded,
              accent: AppPalette.primary,
            ),
            child: Column(
              children: <Widget>[
                _kv('Gross sales', formatCurrency(gross), bold: true),
                const SizedBox(height: 8),
                _kv('Collected', formatCurrency(collected),
                    color: AppPalette.success),
                const SizedBox(height: 8),
                _kv('Outstanding due', formatCurrency(due),
                    color: due > 0 ? AppPalette.warning : AppPalette.success),
              ],
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Collected by mode',
            action: const MobileTag(label: 'TODAY', icon: Icons.payments_rounded),
            child: modeEntries.isEmpty
                ? const MobileEmptyState(
                    icon: Icons.query_stats_rounded,
                    title: 'No sales today',
                    body: 'Payment totals will appear here as you sell.',
                  )
                : Column(
                    children: <Widget>[
                      for (final e in modeEntries) ...<Widget>[
                        _kv(e.key, formatCurrency(e.value)),
                        const SizedBox(height: 8),
                      ],
                    ],
                  ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Cash count',
            action: const MobileTag(
              label: 'RECONCILE',
              icon: Icons.account_balance_wallet_rounded,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _kv('Expected cash', formatCurrency(expectedCash), bold: true),
                const SizedBox(height: 12),
                TextField(
                  controller: _counted,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    labelText: 'Counted cash in drawer',
                    prefixText: '₹ ',
                  ),
                ),
                const SizedBox(height: 14),
                if (variance != null)
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: (variance.abs() < 0.01
                              ? AppPalette.success
                              : AppPalette.error)
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Row(
                      children: <Widget>[
                        Icon(
                          variance.abs() < 0.01
                              ? Icons.check_circle_rounded
                              : Icons.error_rounded,
                          color: variance.abs() < 0.01
                              ? AppPalette.success
                              : AppPalette.error,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            variance.abs() < 0.01
                                ? 'Drawer matches — all good.'
                                : variance > 0
                                ? 'Over by ${formatCurrency(variance)}.'
                                : 'Short by ${formatCurrency(-variance)}.',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _kv(String k, String v, {bool bold = false, Color? color}) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Text(
          k,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colors.textSecondary,
          ),
        ),
        const Spacer(),
        Text(
          v,
          style: (bold ? theme.textTheme.titleMedium : theme.textTheme.bodyLarge)
              ?.copyWith(fontWeight: FontWeight.w800, color: color),
        ),
      ],
    );
  }
}
