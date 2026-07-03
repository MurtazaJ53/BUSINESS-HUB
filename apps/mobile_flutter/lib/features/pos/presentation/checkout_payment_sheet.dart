import 'package:flutter/material.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';

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
  final TextEditingController _buyerGstinController = TextEditingController();
  final TextEditingController _cashTenderedController = TextEditingController();
  
  String _primaryMode = 'CASH';
  bool _isSplit = false;
  
  double get _cashTendered {
    if (_cashTenderedController.text.isEmpty) return 0.0;
    return double.tryParse(_cashTenderedController.text) ?? 0.0;
  }
  
  double get _changeDue {
    if (_primaryMode != 'CASH' && !_isSplit) return 0.0;
    final tendered = _cashTendered;
    final total = widget.cartTotal;
    if (tendered > total) return tendered - total;
    return 0.0;
  }

  void _completeSale() {
    List<PosPayment> payments = [];
    
    if (_isSplit) {
      // Basic split implementation: 50/50 split between CASH and CARD for MVP
      // In a full implementation, you'd have dynamic inputs for each mode.
      final half = widget.cartTotal / 2;
      payments = [
        PosPayment(mode: 'CASH', amount: half),
        PosPayment(mode: 'CARD', amount: half),
      ];
    } else {
      payments = [
        PosPayment(mode: _primaryMode, amount: widget.cartTotal),
      ];
    }
    
    Navigator.pop(context, {
      'payments': payments,
      'buyerGstin': _buyerGstinController.text.trim().isNotEmpty ? _buyerGstinController.text.trim() : null,
      'paymentMode': _isSplit ? 'SPLIT' : _primaryMode,
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.of(context).background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.of(context).border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Checkout', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700)),
                Text(
                  formatCurrency(widget.cartTotal),
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: AppPalette.primary),
                ),
              ],
            ),
            const SizedBox(height: 32),
            
            // Payment Mode Selector
            const Text('PAYMENT METHOD', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
            const SizedBox(height: 12),
            Row(
              children: [
                _PaymentModeBtn(
                  title: 'CASH',
                  icon: Icons.payments_rounded,
                  isSelected: _primaryMode == 'CASH' && !_isSplit,
                  onTap: () => setState(() { _primaryMode = 'CASH'; _isSplit = false; }),
                ),
                const SizedBox(width: 8),
                _PaymentModeBtn(
                  title: 'CARD',
                  icon: Icons.credit_card_rounded,
                  isSelected: _primaryMode == 'CARD' && !_isSplit,
                  onTap: () => setState(() { _primaryMode = 'CARD'; _isSplit = false; }),
                ),
                const SizedBox(width: 8),
                _PaymentModeBtn(
                  title: 'UPI',
                  icon: Icons.qr_code_scanner_rounded,
                  isSelected: _primaryMode == 'UPI' && !_isSplit,
                  onTap: () => setState(() { _primaryMode = 'UPI'; _isSplit = false; }),
                ),
                const SizedBox(width: 8),
                _PaymentModeBtn(
                  title: 'SPLIT',
                  icon: Icons.call_split_rounded,
                  isSelected: _isSplit,
                  onTap: () => setState(() { _isSplit = true; _primaryMode = 'SPLIT'; }),
                ),
              ],
            ),
            
            const SizedBox(height: 24),
            
            // Cash Calculator (if cash is involved)
            if (_primaryMode == 'CASH' || _isSplit) ...[
              TextField(
                controller: _cashTenderedController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: _isSplit ? 'Cash Portion Amount' : 'Cash Tendered (Optional)',
                  prefixIcon: const Icon(Icons.attach_money_rounded),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (_changeDue > 0 && !_isSplit) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppPalette.error.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Change Due:', style: TextStyle(fontWeight: FontWeight.bold, color: AppPalette.error)),
                      Text(formatCurrency(_changeDue), style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppPalette.error)),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 24),
            ],

            TextField(
              controller: _buyerGstinController,
              decoration: InputDecoration(
                labelText: 'Buyer GSTIN (Optional)',
                hintText: 'Enter GSTIN for B2B Tax Invoice',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              textCapitalization: TextCapitalization.characters,
            ),
            const SizedBox(height: 24),
            
            SizedBox(
              height: 56,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppPalette.primary,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                onPressed: _completeSale,
                child: Text('COMPLETE SALE', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, letterSpacing: 1)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentModeBtn extends StatelessWidget {
  const _PaymentModeBtn({required this.title, required this.icon, required this.isSelected, required this.onTap});
  
  final String title;
  final IconData icon;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected ? AppPalette.primary : AppColors.of(context).surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppPalette.primary : AppColors.of(context).border,
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? Colors.white : AppColors.of(context).textSecondary, size: 24),
              const SizedBox(height: 4),
              Text(
                title,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : AppColors.of(context).textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
