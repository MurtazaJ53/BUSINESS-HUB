import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class CustomersScreen extends ConsumerStatefulWidget {
  const CustomersScreen({super.key});

  @override
  ConsumerState<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends ConsumerState<CustomersScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _search = '';
  Future<List<BackendCustomerSummary>>? _backendLookupFuture;
  String? _backendLookupKey;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final salesRepository = ref.watch(salesRepositoryProvider);
    final shopRepository = ref.watch(shopRepositoryProvider);
    final backendApiClient = ref.watch(backendApiClientProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final customerPulseStream = salesRepository.watchCustomerPulse(
      search: _search,
    );
    final historyStream = salesRepository.watchHistoryOverview();
    final domainStatesStream = shopRepository.watchTrackedDomainStates(
      const <String>['customers', 'customer_ledger'],
    );

    return StreamBuilder<List<DomainControlState>>(
      stream: domainStatesStream,
      builder: (context, domainSnapshot) {
        final states = domainSnapshot.data;
        final domainState =
            states?.firstWhere(
              (state) => state.domain == 'customers',
              orElse: () => DomainControlState.legacy('customers'),
            ) ??
            DomainControlState.legacy('customers');
        final ledgerDomainState =
            states?.firstWhere(
              (state) => state.domain == 'customer_ledger',
              orElse: () => DomainControlState.legacy('customer_ledger'),
            ) ??
            DomainControlState.legacy('customer_ledger');

        return StreamBuilder<HistoryOverview>(
          stream: historyStream,
          builder: (context, historySnapshot) {
            final history = historySnapshot.data ?? HistoryOverview.empty();
            final backendFuture = _resolveBackendLookupFuture(
              backendApiClient: backendApiClient,
              session: session,
              domainState: domainState,
            );

            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
              children: <Widget>[
                MobileHeroBanner(
                  eyebrow: 'Customer desk',
                  title: 'Known buyers, cleaner recall.',
                  subtitle: domainState.isPostgresPrimary
                      ? 'Customers are now flowing from the PostgreSQL surface, so balances and ledger signals can travel with the mobile desk.'
                      : 'Until customer cutover finishes, the mobile desk reconstructs buyer recall from local sales history so operators still get useful context.',
                  accent: const Color(0xFF14B8A6),
                  trailing: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: <Widget>[
                      MobileTag(
                        label: domainState.postureLabel,
                        icon: domainState.isPostgresPrimary
                            ? Icons.verified_rounded
                            : Icons.swap_horiz_rounded,
                        accent: domainState.isPostgresPrimary
                            ? const Color(0xFF22C55E)
                            : const Color(0xFF14B8A6),
                      ),
                      const SizedBox(height: 10),
                      MobileTag(
                        label: history.totalSales > 0
                            ? '${history.totalSales} receipts known'
                            : 'Awaiting local history',
                        icon: Icons.receipt_long_rounded,
                        accent: const Color(0xFF38BDF8),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final count = constraints.maxWidth > 520 ? 3 : 2;
                    return GridView.count(
                      crossAxisCount: count,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 1.02,
                      children: <Widget>[
                        MobileMetricCard(
                          label: 'Posture',
                          value: domainState.isPostgresPrimary
                              ? 'Ledger live'
                              : 'Recall mode',
                          caption:
                              domainState.pilotSignoffStatus
                                      ?.replaceAll('_', ' ')
                                      .isNotEmpty ==
                                  true
                              ? domainState.pilotSignoffStatus!.replaceAll(
                                  '_',
                                  ' ',
                                )
                              : domainState.postureLabel,
                          icon: Icons.groups_rounded,
                          accent: const Color(0xFF14B8A6),
                        ),
                        MobileMetricCard(
                          label: 'Ledger',
                          value: ledgerDomainState.isPostgresPrimary
                              ? 'Writable'
                              : 'Read only',
                          caption:
                              ledgerDomainState.pilotSignoffStatus
                                      ?.replaceAll('_', ' ')
                                      .isNotEmpty ==
                                  true
                              ? ledgerDomainState.pilotSignoffStatus!
                                    .replaceAll('_', ' ')
                              : ledgerDomainState.postureLabel,
                          icon: Icons.account_balance_wallet_rounded,
                          accent: ledgerDomainState.isPostgresPrimary
                              ? const Color(0xFF22C55E)
                              : const Color(0xFFF59E0B),
                        ),
                        MobileMetricCard(
                          label: 'Sync',
                          value: syncStatus == MobileSyncStatus.syncing
                              ? 'Refreshing'
                              : 'Stable',
                          caption: syncStatus == MobileSyncStatus.error
                              ? 'Last sync needs attention'
                              : 'Mobile workspace active',
                          icon: Icons.wifi_tethering_rounded,
                          accent: syncStatus == MobileSyncStatus.error
                              ? const Color(0xFFFB7185)
                              : const Color(0xFF38BDF8),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 18),
                MobilePanel(
                  title: 'Customer lookup',
                  action: MobileTag(
                    label: _search.isEmpty ? 'ALL KNOWN BUYERS' : 'FILTERED',
                    icon: Icons.manage_search_rounded,
                    accent: const Color(0xFF14B8A6),
                  ),
                  child: TextField(
                    controller: _searchController,
                    onChanged: (value) {
                      setState(() {
                        _search = value;
                      });
                    },
                    decoration: InputDecoration(
                      hintText: 'Search customer name or phone',
                      prefixIcon: const Icon(Icons.search_rounded),
                      suffixIcon: _search.isEmpty
                          ? null
                          : IconButton(
                              onPressed: () {
                                _searchController.clear();
                                setState(() {
                                  _search = '';
                                });
                              },
                              icon: const Icon(Icons.close_rounded),
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                if (backendFuture != null)
                  FutureBuilder<List<BackendCustomerSummary>>(
                    future: backendFuture,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const MobilePanel(
                          title: 'Customer ledger view',
                          child: MobileEmptyState(
                            icon: Icons.sync_rounded,
                            title: 'Loading PostgreSQL customers',
                            body:
                                'The mobile desk is pulling the live customer surface from the new backend.',
                          ),
                        );
                      }

                      if (snapshot.hasError) {
                        return _LocalCustomersFallbackPanel(
                          customerPulseStream: customerPulseStream,
                          warning:
                              'Backend customer lookup is unavailable right now, so the mobile desk is falling back to local recall.',
                        );
                      }

                      final customers =
                          snapshot.data ?? const <BackendCustomerSummary>[];
                      if (customers.isEmpty) {
                        return const MobilePanel(
                          title: 'Customer ledger view',
                          child: MobileEmptyState(
                            icon: Icons.groups_outlined,
                            title: 'No customers matched',
                            body:
                                'This PostgreSQL customer surface is live, but no records matched the current lookup.',
                          ),
                        );
                      }

                      return MobilePanel(
                        title: 'Customer ledger view',
                        action: MobileTag(
                          label: '${customers.length} live',
                          icon: Icons.verified_rounded,
                          accent: const Color(0xFF22C55E),
                        ),
                        child: Column(
                          children: customers
                              .map(
                                (customer) => Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: _BackendCustomerRow(
                                    customer: customer,
                                    onTap: () async {
                                      final changed = await _openLedgerSheet(
                                        context,
                                        backendApiClient: backendApiClient,
                                        session: session,
                                        customer: customer,
                                        ledgerDomainState: ledgerDomainState,
                                      );
                                      if (changed == true && mounted) {
                                        setState(() {
                                          _backendLookupFuture = null;
                                          _backendLookupKey = null;
                                        });
                                      }
                                    },
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      );
                    },
                  )
                else
                  _LocalCustomersFallbackPanel(
                    customerPulseStream: customerPulseStream,
                  ),
              ],
            );
          },
        );
      },
    );
  }

  Future<List<BackendCustomerSummary>>? _resolveBackendLookupFuture({
    required BackendApiClient backendApiClient,
    required MobileSession? session,
    required DomainControlState domainState,
  }) {
    if (!domainState.isPostgresPrimary || session == null || !session.hasShop) {
      _backendLookupFuture = null;
      _backendLookupKey = null;
      return null;
    }

    final nextKey =
        '${session.shopId}|${domainState.currentEpoch}|${domainState.cutoverStatus}|${_search.trim().toLowerCase()}';
    if (_backendLookupFuture == null || _backendLookupKey != nextKey) {
      _backendLookupKey = nextKey;
      _backendLookupFuture = backendApiClient.fetchCustomers(
        user: session.user,
        shopId: session.shopId!,
        query: _search,
      );
    }
    return _backendLookupFuture;
  }

  Future<bool?> _openLedgerSheet(
    BuildContext context, {
    required BackendApiClient backendApiClient,
    required MobileSession? session,
    required BackendCustomerSummary customer,
    required DomainControlState ledgerDomainState,
  }) async {
    if (session == null || !session.hasShop) {
      return false;
    }

    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            child: FutureBuilder<List<CustomerLedgerPreviewEntry>>(
              future: backendApiClient.fetchCustomerLedger(
                user: session.user,
                shopId: session.shopId!,
                customerId: customer.id,
              ),
              builder: (context, snapshot) {
                final theme = Theme.of(context);
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const MobileEmptyState(
                    icon: Icons.sync_rounded,
                    title: 'Loading customer ledger',
                    body:
                        'The mobile desk is pulling the latest customer ledger entries from the backend.',
                  );
                }

                if (snapshot.hasError) {
                  return MobileEmptyState(
                    icon: Icons.error_outline_rounded,
                    title: 'Ledger pull failed',
                    body: snapshot.error.toString(),
                  );
                }

                final entries =
                    snapshot.data ?? const <CustomerLedgerPreviewEntry>[];
                return Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      customer.name,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      customer.phone ?? customer.email ?? 'No contact recorded',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.68),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        MobileTag(
                          label: 'Balance ${formatCurrency(customer.balance)}',
                          icon: Icons.account_balance_wallet_rounded,
                          accent: customer.balance > 0
                              ? const Color(0xFFFB7185)
                              : const Color(0xFF22C55E),
                        ),
                        MobileTag(
                          label: 'Spent ${formatCurrency(customer.totalSpent)}',
                          icon: Icons.trending_up_rounded,
                          accent: const Color(0xFF38BDF8),
                        ),
                      ],
                    ),
                    if (ledgerDomainState.isPostgresPrimary) ...<Widget>[
                      const SizedBox(height: 14),
                      FilledButton.tonalIcon(
                        onPressed: () async {
                          final changed = await _showLedgerMutationDialog(
                            context,
                            backendApiClient: backendApiClient,
                            session: session,
                            customer: customer,
                          );
                          if (changed == true && context.mounted) {
                            Navigator.of(context).pop(true);
                          }
                        },
                        icon: const Icon(Icons.edit_note_rounded),
                        label: const Text('Record payment or adjustment'),
                      ),
                    ],
                    const SizedBox(height: 18),
                    if (entries.isEmpty)
                      const MobileEmptyState(
                        icon: Icons.receipt_long_outlined,
                        title: 'No ledger entries yet',
                        body:
                            'This customer exists on the backend, but the mobile desk has no ledger entries to preview yet.',
                      )
                    else
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxHeight: 320),
                        child: ListView(
                          shrinkWrap: true,
                          children: entries
                              .map(
                                (entry) => Padding(
                                  padding: const EdgeInsets.only(bottom: 10),
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF0A1220),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(
                                        color: Colors.white.withValues(
                                          alpha: 0.05,
                                        ),
                                      ),
                                    ),
                                    child: Padding(
                                      padding: const EdgeInsets.all(14),
                                      child: Row(
                                        children: <Widget>[
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: <Widget>[
                                                Text(
                                                  entry.eventType
                                                      .replaceAll('_', ' ')
                                                      .toUpperCase(),
                                                  style: theme
                                                      .textTheme
                                                      .labelLarge
                                                      ?.copyWith(
                                                        fontWeight:
                                                            FontWeight.w900,
                                                      ),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  entry.note ??
                                                      entry.actorName ??
                                                      formatCompactDate(
                                                        entry.occurredAt,
                                                      ),
                                                  style: theme
                                                      .textTheme
                                                      .bodySmall
                                                      ?.copyWith(
                                                        color: Colors.white
                                                            .withValues(
                                                              alpha: 0.62,
                                                            ),
                                                        fontWeight:
                                                            FontWeight.w600,
                                                      ),
                                                ),
                                              ],
                                            ),
                                          ),
                                          Text(
                                            formatCurrency(entry.amountDelta),
                                            style: theme.textTheme.titleMedium
                                                ?.copyWith(
                                                  color: entry.amountDelta > 0
                                                      ? const Color(0xFFFB7185)
                                                      : const Color(0xFF22C55E),
                                                  fontWeight: FontWeight.w900,
                                                ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                              )
                              .toList(growable: false),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }

  Future<bool> _showLedgerMutationDialog(
    BuildContext context, {
    required BackendApiClient backendApiClient,
    required MobileSession session,
    required BackendCustomerSummary customer,
  }) async {
    final amountController = TextEditingController();
    final noteController = TextEditingController();
    var eventType = 'payment';

    try {
      final result = await showDialog<bool>(
        context: context,
        builder: (dialogContext) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: Text('Update ${customer.name}'),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    DropdownButtonFormField<String>(
                      initialValue: eventType,
                      items: const <DropdownMenuItem<String>>[
                        DropdownMenuItem(
                          value: 'payment',
                          child: Text('Record payment received'),
                        ),
                        DropdownMenuItem(
                          value: 'adjustment',
                          child: Text('Manual balance adjustment'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value == null) {
                          return;
                        }
                        setDialogState(() {
                          eventType = value;
                        });
                      },
                      decoration: const InputDecoration(
                        labelText: 'Entry type',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: amountController,
                      keyboardType: const TextInputType.numberWithOptions(
                        signed: true,
                        decimal: true,
                      ),
                      decoration: InputDecoration(
                        labelText: eventType == 'payment'
                            ? 'Amount received'
                            : 'Balance delta (+ add due, - reduce)',
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: noteController,
                      minLines: 2,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Note'),
                    ),
                  ],
                ),
                actions: <Widget>[
                  TextButton(
                    onPressed: () => Navigator.of(dialogContext).pop(false),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    onPressed: () async {
                      final rawAmount =
                          double.tryParse(amountController.text.trim()) ?? 0;
                      if (rawAmount == 0) {
                        return;
                      }

                      final draft = CustomerLedgerMutationDraft(
                        eventType: eventType,
                        amountDelta: eventType == 'payment'
                            ? -rawAmount.abs()
                            : rawAmount,
                        note: noteController.text.trim(),
                      );

                      try {
                        await backendApiClient.createCustomerLedgerEntry(
                          user: session.user,
                          shopId: session.shopId!,
                          customerId: customer.id,
                          draft: draft,
                        );
                        if (dialogContext.mounted) {
                          Navigator.of(dialogContext).pop(true);
                        }
                      } catch (error) {
                        if (dialogContext.mounted) {
                          ScaffoldMessenger.of(dialogContext).showSnackBar(
                            SnackBar(
                              content: Text('Ledger update failed: $error'),
                            ),
                          );
                        }
                      }
                    },
                    child: const Text('Save'),
                  ),
                ],
              );
            },
          );
        },
      );
      return result == true;
    } finally {
      amountController.dispose();
      noteController.dispose();
    }
  }
}

class _LocalCustomersFallbackPanel extends StatelessWidget {
  const _LocalCustomersFallbackPanel({
    required this.customerPulseStream,
    this.warning,
  });

  final Stream<List<CustomerPulseSummary>> customerPulseStream;
  final String? warning;

  @override
  Widget build(BuildContext context) {
    return MobilePanel(
      title: 'Customer recall from local history',
      action: MobileTag(
        label: 'LOCAL RECALL',
        icon: Icons.offline_bolt_rounded,
        accent: const Color(0xFF14B8A6),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (warning != null) ...<Widget>[
            DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xFF2A1508),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: const Color(0xFFF59E0B).withValues(alpha: 0.16),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Text(
                  warning!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.78),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
          ],
          StreamBuilder<List<CustomerPulseSummary>>(
            stream: customerPulseStream,
            builder: (context, snapshot) {
              final customers = snapshot.data ?? const <CustomerPulseSummary>[];
              if (customers.isEmpty) {
                return const MobileEmptyState(
                  icon: Icons.groups_outlined,
                  title: 'No known buyers matched',
                  body:
                      'The local mobile vault has not seen any named or phoned customer receipts for this lookup yet.',
                );
              }

              return Column(
                children: customers
                    .map(
                      (customer) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _LocalCustomerRow(customer: customer),
                      ),
                    )
                    .toList(growable: false),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _BackendCustomerRow extends StatelessWidget {
  const _BackendCustomerRow({required this.customer, required this.onTap});

  final BackendCustomerSummary customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final balanceTone = customer.balance > 0
        ? const Color(0xFFFB7185)
        : const Color(0xFF22C55E);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
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
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: const Color(0xFF14B8A6).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.groups_rounded,
                    color: Color(0xFF14B8A6),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        customer.name,
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        customer.phone ?? customer.email ?? customer.status,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.58),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: <Widget>[
                          MobileTag(
                            label:
                                'Spent ${formatCurrency(customer.totalSpent)}',
                            icon: Icons.trending_up_rounded,
                            accent: const Color(0xFF38BDF8),
                          ),
                          MobileTag(
                            label:
                                'Balance ${formatCurrency(customer.balance)}',
                            icon: Icons.account_balance_wallet_rounded,
                            accent: balanceTone,
                          ),
                        ],
                      ),
                    ],
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

class _LocalCustomerRow extends StatelessWidget {
  const _LocalCustomerRow({required this.customer});

  final CustomerPulseSummary customer;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
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
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFF14B8A6).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.person_search_rounded,
                color: Color(0xFF14B8A6),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    customer.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    customer.phone ??
                        'Last seen ${formatCompactDate(customer.lastSeenAt)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      MobileTag(
                        label: '${customer.visitCount} visits',
                        icon: Icons.repeat_rounded,
                        accent: const Color(0xFF38BDF8),
                      ),
                      MobileTag(
                        label:
                            'Spent ${formatCurrency(customer.lifetimeSpend)}',
                        icon: Icons.currency_rupee_rounded,
                        accent: const Color(0xFF22C55E),
                      ),
                      if (customer.pendingSales > 0)
                        MobileTag(
                          label: '${customer.pendingSales} queued',
                          icon: Icons.cloud_upload_rounded,
                          accent: const Color(0xFFF59E0B),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
