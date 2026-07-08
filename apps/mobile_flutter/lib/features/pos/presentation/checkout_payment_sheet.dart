import 'package:flutter/material.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/tax/gst.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';

const List<String> _paymentModes = <String>['CASH', 'CARD', 'UPI'];

/// A single payment line in a (possibly split) checkout.
class _PayLine {
  _PayLine(this.mode, double initial)
    : amount = TextEditingController(
        text: initial > 0 ? initial.toStringAsFixed(2) : '',
      );

  String mode;
  final TextEditingController amount;

  double get value => double.tryParse(amount.text.trim()) ?? 0;

  void dispose() => amount.dispose();
}

/// Checkout sheet with a real, user-defined split payment.
///
/// Any number of payment lines (CASH/CARD/UPI) can be entered. If the entered
/// total is less than the amount due, the balance is recorded as a customer due
/// (khata); if it exceeds a cash payment, the surplus is shown as change.
class CheckoutPaymentSheet extends StatefulWidget {
  const CheckoutPaymentSheet({
    super.key,
    required this.cartTotal,
    required this.gstSummary,
  });

  final double cartTotal;
  final GstCartSummary gstSummary;

  @override
  State<CheckoutPaymentSheet> createState() => _CheckoutPaymentSheetState();
}

class _CheckoutPaymentSheetState extends State<CheckoutPaymentSheet> {
  final TextEditingController _buyerGstin = TextEditingController();
  final List<_PayLine> _lines = <_PayLine>[];

  @override
  void initState() {
    super.initState();
    // Start with the full amount tendered in cash — the common case.
    _lines.add(_PayLine('CASH', widget.cartTotal));
  }

  @override
  void dispose() {
    _buyerGstin.dispose();
    for (final line in _lines) {
      line.dispose();
    }
    super.dispose();
  }

  double get _paid => _lines.fold<double>(0, (sum, l) => sum + l.value);
  double get _due {
    final d = widget.cartTotal - _paid;
    return d > 0.009 ? d : 0;
  }

  double get _change {
    final c = _paid - widget.cartTotal;
    return c > 0.009 ? c : 0;
  }

  void _addLine() {
    setState(() => _lines.add(_PayLine('CASH', _due)));
  }

  void _removeLine(int index) {
    setState(() {
      _lines.removeAt(index).dispose();
      if (_lines.isEmpty) {
        _lines.add(_PayLine('CASH', 0));
      }
    });
  }

  void _completeSale() {
    final payments = _lines
        .where((l) => l.value > 0)
        .map((l) => PosPayment(mode: l.mode, amount: l.value))
        .toList(growable: false);
    final mode = payments.isEmpty
        ? 'CREDIT'
        : payments.length == 1
        ? payments.first.mode
        : 'SPLIT';
    Navigator.pop(context, <String, dynamic>{
      'payments': payments,
      'paymentMode': mode,
      'buyerGstin': _buyerGstin.text.trim().isEmpty
          ? null
          : _buyerGstin.text.trim(),
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    final isSplit = _lines.length > 1;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: SafeArea(
          top: false,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    Text(
                      'Checkout',
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      formatCurrency(widget.cartTotal),
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        color: AppPalette.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Text(
                  isSplit ? 'SPLIT PAYMENT' : 'PAYMENT',
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: colors.textTertiary,
                  ),
                ),
                const SizedBox(height: 10),
                for (int i = 0; i < _lines.length; i++) ...<Widget>[
                  _PaymentLineRow(
                    line: _lines[i],
                    canRemove: _lines.length > 1,
                    onModeChanged: (mode) =>
                        setState(() => _lines[i].mode = mode),
                    onAmountChanged: () => setState(() {}),
                    onRemove: () => _removeLine(i),
                  ),
                  const SizedBox(height: 10),
                ],
                Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: _addLine,
                    icon: const Icon(Icons.add_rounded, size: 18),
                    label: const Text('Add split'),
                  ),
                ),
                const SizedBox(height: 12),
                // Live summary
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colors.borderSoft),
                  ),
                  child: Column(
                    children: <Widget>[
                      _SummaryLine(label: 'Total', value: widget.cartTotal),
                      const SizedBox(height: 6),
                      _SummaryLine(
                        label: 'Paid',
                        value: _paid,
                        valueColor: AppPalette.success,
                      ),
                      if (_due > 0) ...<Widget>[
                        const SizedBox(height: 6),
                        _SummaryLine(
                          label: 'Balance due',
                          value: _due,
                          valueColor: AppPalette.warning,
                          bold: true,
                        ),
                      ],
                      if (_change > 0) ...<Widget>[
                        const SizedBox(height: 6),
                        _SummaryLine(
                          label: 'Change',
                          value: _change,
                          valueColor: AppPalette.primary,
                          bold: true,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _buyerGstin,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    labelText: 'Buyer GSTIN (optional)',
                    hintText: 'For a B2B tax invoice',
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  height: 56,
                  child: FilledButton(
                    onPressed: _completeSale,
                    child: Text(
                      _due > 0
                          ? 'Save with ${formatCurrency(_due)} due'
                          : 'Complete sale',
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
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

class _PaymentLineRow extends StatelessWidget {
  const _PaymentLineRow({
    required this.line,
    required this.canRemove,
    required this.onModeChanged,
    required this.onAmountChanged,
    required this.onRemove,
  });

  final _PayLine line;
  final bool canRemove;
  final ValueChanged<String> onModeChanged;
  final VoidCallback onAmountChanged;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: <Widget>[
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.borderSoft),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: line.mode,
              borderRadius: BorderRadius.circular(14),
              items: _paymentModes
                  .map(
                    (m) => DropdownMenuItem<String>(
                      value: m,
                      child: Text(
                        m,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: (m) {
                if (m != null) onModeChanged(m);
              },
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: TextField(
            controller: line.amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            onChanged: (_) => onAmountChanged(),
            decoration: const InputDecoration(
              isDense: true,
              hintText: 'Amount',
              prefixText: '₹ ',
            ),
          ),
        ),
        if (canRemove)
          IconButton(
            onPressed: onRemove,
            icon: const Icon(Icons.remove_circle_outline_rounded),
            color: AppPalette.error,
          ),
      ],
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine({
    required this.label,
    required this.value,
    this.valueColor,
    this.bold = false,
  });

  final String label;
  final double value;
  final Color? valueColor;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(
            color: colors.textSecondary,
            fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
        const Spacer(),
        Text(
          formatCurrency(value),
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}
