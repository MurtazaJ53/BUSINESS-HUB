import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/util/whatsapp.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/premium_components.dart';

/// Redesigned Customers Screen v3.0
/// Simple, Clean, Premium, Professional
class CustomersScreenV3 extends ConsumerStatefulWidget {
  const CustomersScreenV3({super.key});

  @override
  ConsumerState<CustomersScreenV3> createState() => _CustomersScreenV3State();
}

class _CustomersScreenV3State extends ConsumerState<CustomersScreenV3> {
  final TextEditingController _searchController = TextEditingController();

  String _search = '';
  bool _showWithDuesOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final customersAsync = ref.watch(customersProvider);
    final customers =
        customersAsync.asData?.value ?? const <BackendCustomerSummary>[];

    final filteredCustomers = customers.where((customer) {
      if (_search.isNotEmpty &&
          !customer.name.toLowerCase().contains(_search.toLowerCase())) {
        return false;
      }
      if (_showWithDuesOnly && customer.balance <= 0) {
        return false;
      }
      return true;
    }).toList();

    // Calculate metrics
    final totalCustomers = customers.length;
    final totalDues = customers.fold<double>(
      0,
      (sum, c) => sum + (c.balance > 0 ? c.balance : 0),
    );
    final customersWithDues = customers.where((c) => c.balance > 0).length;

    return Scaffold(
      backgroundColor: AppColors.of(context).background,
      body: SafeArea(
        child: Column(
          children: [
            // Header with search
            _buildHeader(context),

            // Metrics
            _buildMetrics(
              totalCustomers: totalCustomers,
              totalDues: totalDues,
              customersWithDues: customersWithDues,
            ),

            // Filters
            _buildFilters(),

            // Customers list
            Expanded(
              child: customersAsync.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : filteredCustomers.isEmpty
                  ? EmptyStateWidget(
                      icon: Icons.groups_rounded,
                      title: 'No customers found',
                      message: _search.isEmpty
                          ? 'Start adding customers to track sales'
                          : 'Try a different search term',
                    )
                  : _buildCustomersList(filteredCustomers),
            ),
          ],
        ),
      ),
      // Add customer FAB
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddCustomerSheet(context),
        backgroundColor: AppPalette.primary,
        icon: const Icon(Icons.person_add_rounded, size: 24),
        label: Text(
          'Add Customer',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => context.pop(),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 12),
              Text(
                'Customers',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          PremiumSearchBar(
            controller: _searchController,
            hintText: 'Search customers...',
            onChanged: (value) {
              setState(() {
                _search = value;
              });
            },
            onClear: () {
              setState(() {
                _search = '';
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildMetrics({
    required int totalCustomers,
    required double totalDues,
    required int customersWithDues,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: _buildMetricBox(
              label: 'Total',
              value: '$totalCustomers',
              icon: Icons.groups_rounded,
              color: AppPalette.customer,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildMetricBox(
              label: 'Dues',
              value: formatCurrency(totalDues),
              icon: Icons.account_balance_wallet_rounded,
              color: totalDues > 0 ? AppPalette.warning : AppPalette.success,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricBox({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: color),
              const SizedBox(width: 8),
              Text(
                label.toUpperCase(),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 1.2,
                  color: color,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              'Show customers with dues only',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.of(context).textPrimary,
              ),
            ),
          ),
          Switch(
            value: _showWithDuesOnly,
            onChanged: (value) {
              setState(() {
                _showWithDuesOnly = value;
              });
            },
            activeColor: AppPalette.primary,
          ),
        ],
      ),
    );
  }

  Widget _buildCustomersList(List<BackendCustomerSummary> customers) {
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 100),
      itemCount: customers.length,
      itemBuilder: (context, index) {
        final customer = customers[index];
        final hasDues = customer.balance > 0;

        return EnhancedListItem(
          title: customer.name,
          subtitle: (customer.phone ?? '').isEmpty
              ? (hasDues
                    ? 'Due: ${formatCurrency(customer.balance)}'
                    : 'No dues')
              : '${customer.phone}${hasDues ? ' • Due: ${formatCurrency(customer.balance)}' : ''}',
          leadingIcon: Icons.person_rounded,
          leadingColor: hasDues ? AppPalette.warning : AppPalette.customer,
          trailing: hasDues
              ? StatusBadge(
                  label: formatCurrency(customer.balance),
                  color: AppPalette.warning,
                  showDot: false,
                )
              : null,
          onTap: () => _showCustomerDetails(context, customer),
        );
      },
    );
  }

  void _showCustomerDetails(
    BuildContext context,
    BackendCustomerSummary customer,
  ) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: AppColors.of(context).background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
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

            // Customer details
            Row(
              children: [
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: AppPalette.customer.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Icon(
                    Icons.person_rounded,
                    size: 32,
                    color: AppPalette.customer,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        customer.name,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: AppColors.of(context).textPrimary,
                        ),
                      ),
                      if ((customer.phone ?? '').isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          customer.phone!,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: AppColors.of(context).textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Balance
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: customer.balance > 0
                    ? AppPalette.warning.withValues(alpha: 0.1)
                    : AppPalette.success.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: customer.balance > 0
                      ? AppPalette.warning.withValues(alpha: 0.2)
                      : AppPalette.success.withValues(alpha: 0.2),
                  width: 1,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'BALANCE',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 1.2,
                      color: customer.balance > 0
                          ? AppPalette.warning
                          : AppPalette.success,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    formatCurrency(customer.balance),
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: customer.balance > 0
                          ? AppPalette.warning
                          : AppPalette.success,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Actions
            Row(
              children: [
                if (customer.balance > 0) ...[
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _recordPayment(context, customer);
                      },
                      icon: const Icon(Icons.payments_rounded),
                      label: const Text('Record payment'),
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _showAddCustomerSheet(context, existing: customer);
                    },
                    icon: const Icon(Icons.edit_rounded),
                    label: const Text('Edit'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: <Widget>[
                Expanded(
                  child: TextButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _showLedger(context, customer);
                    },
                    icon: const Icon(Icons.receipt_long_rounded),
                    label: const Text('Khata'),
                  ),
                ),
                if ((customer.phone ?? '').trim().isNotEmpty)
                  Expanded(
                    child: TextButton.icon(
                      onPressed: () => _messageOnWhatsApp(context, customer),
                      icon: const Icon(Icons.chat_rounded),
                      label: const Text('WhatsApp'),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF25D366),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _messageOnWhatsApp(
    BuildContext context,
    BackendCustomerSummary customer,
  ) async {
    final shopName =
        ref.read(shopInfoProvider).asData?.value?.name ?? 'our shop';
    final message = customer.balance > 0
        ? 'Hello ${customer.name}, this is a friendly reminder from $shopName. '
              'Your pending balance is ${formatCurrency(customer.balance)}. '
              'Thank you!'
        : 'Hello ${customer.name}, thank you for shopping with $shopName!';
    final ok = await openWhatsApp(phone: customer.phone ?? '', message: message);
    if (!ok && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open WhatsApp for this number.')),
      );
    }
  }

  /// Unified credit + payment timeline with a running balance.
  void _showLedger(BuildContext context, BackendCustomerSummary customer) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.of(context).background,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  'Khata · ${customer.name}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Current due ${formatCurrency(customer.balance)}',
                  style: TextStyle(
                    color: customer.balance > 0
                        ? AppPalette.error
                        : AppPalette.success,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 360,
                  child: Consumer(
                    builder: (context, ref, _) {
                      final entries =
                          ref
                              .watch(customerLedgerProvider(customer.id))
                              .asData
                              ?.value ??
                          const <CustomerLedgerRecord>[];
                      if (entries.isEmpty) {
                        return const Center(
                          child: Text(
                            'No credit or payments yet.\nCredit sales and '
                            'payments will appear here.',
                            textAlign: TextAlign.center,
                          ),
                        );
                      }
                      return ListView.separated(
                        itemCount: entries.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final e = entries[index];
                          return ListTile(
                            dense: true,
                            leading: Icon(
                              e.isPayment
                                  ? Icons.south_west_rounded
                                  : Icons.north_east_rounded,
                              color: e.isPayment
                                  ? AppPalette.success
                                  : AppPalette.error,
                            ),
                            title: Text(
                              '${e.isPayment ? 'Payment' : 'Credit'} '
                              '${formatCurrency(e.amount.abs())}',
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Text(
                              '${e.createdAt.toIso8601String().split('T').first}'
                              '${e.note.isNotEmpty ? ' · ${e.note}' : ''}',
                            ),
                            trailing: Text(
                              'Due ${formatCurrency(e.balanceAfter)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showAddCustomerSheet(
    BuildContext context, {
    BackendCustomerSummary? existing,
  }) {
    final isEdit = existing != null;
    final nameController = TextEditingController(text: existing?.name ?? '');
    final phoneController = TextEditingController(text: existing?.phone ?? '');
    final emailController = TextEditingController(text: existing?.email ?? '');
    final notesController = TextEditingController(text: existing?.notes ?? '');
    final balanceController = TextEditingController();
    var isSaving = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          Future<void> save() async {
            final name = nameController.text.trim();
            if (name.isEmpty || isSaving) return;
            setSheetState(() => isSaving = true);
            try {
              final now = DateTime.now();
              final id =
                  existing?.id ?? 'local-cust-${now.microsecondsSinceEpoch}';
              final opening =
                  double.tryParse(balanceController.text.trim()) ?? 0;
              await ref
                  .read(customerRepositoryProvider)
                  .mergeRemoteCustomerDocument(
                    id,
                    <String, dynamic>{
                      'name': name,
                      'phone': phoneController.text.trim(),
                      'email': emailController.text.trim(),
                      'notes': notesController.text.trim(),
                      'status': 'active',
                      'balance': isEdit ? existing.balance : opening,
                      'total_spent': isEdit ? existing.totalSpent : 0,
                      'tombstone': false,
                      'updatedAt': now.toIso8601String(),
                    },
                    updatedAt: now.millisecondsSinceEpoch,
                  );
              if (!sheetContext.mounted) return;
              Navigator.pop(sheetContext);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('$name ${isEdit ? 'updated' : 'added'}.'),
                ),
              );
            } catch (error) {
              if (!sheetContext.mounted) return;
              setSheetState(() => isSaving = false);
              ScaffoldMessenger.of(sheetContext).showSnackBar(
                SnackBar(content: Text('Save failed: $error')),
              );
            }
          }

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.of(sheetContext).background,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              padding: const EdgeInsets.all(24),
              child: SafeArea(
                top: false,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.of(sheetContext).border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        isEdit ? 'Edit Customer' : 'Add New Customer',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: nameController,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'Name'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: phoneController,
                        keyboardType: TextInputType.phone,
                        decoration: const InputDecoration(labelText: 'Phone'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          labelText: 'Email (optional)',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: notesController,
                        decoration: const InputDecoration(
                          labelText: 'Notes (optional)',
                        ),
                      ),
                      if (!isEdit) ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: balanceController,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Opening due (optional)',
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),
                      PrimaryActionButton(
                        label: isSaving
                            ? 'Saving...'
                            : (isEdit ? 'Save Changes' : 'Create Customer'),
                        icon: isEdit
                            ? Icons.check_rounded
                            : Icons.person_add_rounded,
                        onPressed: isSaving ? null : save,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    ).whenComplete(() {
      nameController.dispose();
      phoneController.dispose();
      emailController.dispose();
      notesController.dispose();
      balanceController.dispose();
    });
  }

  void _recordPayment(BuildContext context, BackendCustomerSummary customer) {
    final amountController = TextEditingController();
    var isSaving = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => StatefulBuilder(
        builder: (sheetContext, setSheetState) {
          Future<void> save() async {
            final amount = double.tryParse(amountController.text.trim()) ?? 0;
            if (amount <= 0 || isSaving) return;
            setSheetState(() => isSaving = true);
            try {
              final newBalance = await ref
                  .read(customerRepositoryProvider)
                  .recordPayment(
                    customerId: customer.id,
                    amount: amount,
                    actorName: ref
                        .read(mobileSessionProvider)
                        .asData
                        ?.value
                        ?.user
                        .displayName,
                  );
              if (!sheetContext.mounted) return;
              Navigator.pop(sheetContext);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(
                    'Payment recorded. New due ${formatCurrency(newBalance)}.',
                  ),
                ),
              );
            } catch (error) {
              if (!sheetContext.mounted) return;
              setSheetState(() => isSaving = false);
              ScaffoldMessenger.of(sheetContext).showSnackBar(
                SnackBar(content: Text('Failed: $error')),
              );
            }
          }

          return Padding(
            padding: EdgeInsets.only(
              bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: Container(
              decoration: BoxDecoration(
                color: AppColors.of(sheetContext).background,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              padding: const EdgeInsets.all(24),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.of(sheetContext).border,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Record payment',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${customer.name} · due ${formatCurrency(customer.balance)}',
                      style: TextStyle(
                        color: AppColors.of(sheetContext).textSecondary,
                      ),
                    ),
                    const SizedBox(height: 20),
                    TextField(
                      controller: amountController,
                      autofocus: true,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(
                        labelText: 'Amount received',
                      ),
                    ),
                    const SizedBox(height: 20),
                    PrimaryActionButton(
                      label: isSaving ? 'Saving...' : 'Record payment',
                      icon: Icons.payments_rounded,
                      onPressed: isSaving ? null : save,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    ).whenComplete(() => amountController.dispose());
  }
}
