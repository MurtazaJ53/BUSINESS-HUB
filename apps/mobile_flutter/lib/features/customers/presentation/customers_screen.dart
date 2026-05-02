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
  String _statusFilter = 'all';
  String _sortMode = 'due_desc';
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
                    label: _statusFilter == 'all'
                        ? (_search.isEmpty ? 'ALL KNOWN BUYERS' : 'FILTERED')
                        : _statusFilter.replaceAll('_', ' ').toUpperCase(),
                    icon: Icons.manage_search_rounded,
                    accent: const Color(0xFF14B8A6),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      TextField(
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
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _customerStatusFilters
                            .map(
                              (filter) => _CustomerFilterChip(
                                label: filter.label,
                                active: _statusFilter == filter.value,
                                onTap: () {
                                  setState(() {
                                    _statusFilter = filter.value;
                                  });
                                },
                              ),
                            )
                            .toList(growable: false),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _customerSortModes
                            .map(
                              (sort) => _CustomerFilterChip(
                                label: sort.label,
                                active: _sortMode == sort.value,
                                onTap: () {
                                  setState(() {
                                    _sortMode = sort.value;
                                  });
                                },
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ],
                  ),
                ),
                if (domainState.isPostgresPrimary &&
                    session?.hasShop == true) ...<Widget>[
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: FilledButton.tonalIcon(
                      onPressed: () async {
                        final changed = await _showCustomerUpsertDialog(
                          context,
                          backendApiClient: backendApiClient,
                          session: session!,
                        );
                        if (changed && mounted) {
                          _resetBackendLookup();
                        }
                      },
                      icon: const Icon(Icons.person_add_alt_1_rounded),
                      label: const Text('Create migrated customer'),
                    ),
                  ),
                ],
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
                      final filteredCustomers = _applyBackendCustomerFilters(
                        customers,
                      );
                      if (customers.isEmpty) {
                        return MobilePanel(
                          title: 'Customer ledger view',
                          child: Column(
                            children: <Widget>[
                              const MobileEmptyState(
                                icon: Icons.groups_outlined,
                                title: 'No customers matched',
                                body:
                                    'This PostgreSQL customer surface is live, but no records matched the current lookup.',
                              ),
                              if (session?.hasShop == true) ...<Widget>[
                                const SizedBox(height: 12),
                                FilledButton.tonalIcon(
                                  onPressed: () async {
                                    final changed =
                                        await _showCustomerUpsertDialog(
                                          context,
                                          backendApiClient: backendApiClient,
                                          session: session!,
                                        );
                                    if (changed && mounted) {
                                      _resetBackendLookup();
                                    }
                                  },
                                  icon: const Icon(
                                    Icons.person_add_alt_1_rounded,
                                  ),
                                  label: const Text('Create first customer'),
                                ),
                              ],
                            ],
                          ),
                        );
                      }

                      final orderedCustomers = _sortBackendCustomers(
                        filteredCustomers,
                      );
                      final summary =
                          _BackendCustomerSummaryReport.fromCustomers(
                            orderedCustomers,
                          );
                      return MobilePanel(
                        title: 'Customer ledger view',
                        action: MobileTag(
                          label: '${orderedCustomers.length} live',
                          icon: Icons.verified_rounded,
                          accent: const Color(0xFF22C55E),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            if (orderedCustomers.isEmpty)
                              const MobileEmptyState(
                                icon: Icons.groups_outlined,
                                title: 'No customers matched this view',
                                body:
                                    'Broaden the search or customer filter to bring more ledger accounts into view.',
                              )
                            else ...<Widget>[
                              Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: <Widget>[
                                  _CustomerSummaryTile(
                                    label: 'Visible',
                                    value: '${summary.visibleCount}',
                                    tone: const Color(0xFF14B8A6),
                                  ),
                                  _CustomerSummaryTile(
                                    label: 'Receivable',
                                    value: formatCurrency(
                                      summary.receivableBalance,
                                    ),
                                    tone: summary.receivableBalance > 0
                                        ? const Color(0xFFF59E0B)
                                        : const Color(0xFF22C55E),
                                  ),
                                  _CustomerSummaryTile(
                                    label: 'With due',
                                    value: '${summary.dueCount}',
                                    tone: const Color(0xFFFB7185),
                                  ),
                                  _CustomerSummaryTile(
                                    label: 'Inactive',
                                    value: '${summary.inactiveCount}',
                                    tone: const Color(0xFFA78BFA),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Text(
                                summary.highestBalanceCustomer == null
                                    ? 'No customer currently holds a due balance.'
                                    : 'Highest due: ${summary.highestBalanceCustomer!.name} · ${formatCurrency(summary.highestBalanceCustomer!.balance)}',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: Colors.white.withValues(
                                        alpha: 0.62,
                                      ),
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                              const SizedBox(height: 14),
                              if (summary.collectionsQueue.isNotEmpty)
                                _CollectionsQueuePanel(
                                  customers: summary.collectionsQueue,
                                  onSelectCustomer: (customer) async {
                                    final changed = await _openLedgerSheet(
                                      context,
                                      backendApiClient: backendApiClient,
                                      session: session,
                                      customer: customer,
                                      ledgerDomainState: ledgerDomainState,
                                    );
                                    if (changed == true && mounted) {
                                      _resetBackendLookup();
                                    }
                                  },
                                ),
                              if (summary.collectionsQueue.isNotEmpty)
                                const SizedBox(height: 14),
                              ...orderedCustomers.map(
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
                                        _resetBackendLookup();
                                      }
                                    },
                                  ),
                                ),
                              ),
                            ],
                          ],
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

  void _resetBackendLookup() {
    setState(() {
      _backendLookupFuture = null;
      _backendLookupKey = null;
    });
  }

  List<BackendCustomerSummary> _applyBackendCustomerFilters(
    List<BackendCustomerSummary> customers,
  ) {
    return customers
        .where((customer) {
          return switch (_statusFilter) {
            'with_due' => customer.balance > 0.009,
            'active_only' => customer.status.toLowerCase() == 'active',
            'inactive_only' => customer.status.toLowerCase() != 'active',
            _ => true,
          };
        })
        .toList(growable: false);
  }

  List<BackendCustomerSummary> _sortBackendCustomers(
    List<BackendCustomerSummary> customers,
  ) {
    final next = List<BackendCustomerSummary>.from(customers);
    next.sort((left, right) {
      return switch (_sortMode) {
        'spent_desc' => right.totalSpent.compareTo(left.totalSpent),
        'name_asc' => left.name.toLowerCase().compareTo(
          right.name.toLowerCase(),
        ),
        _ => right.balance.compareTo(left.balance),
      };
    });
    return next;
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
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: <Widget>[
                          FilledButton.tonalIcon(
                            onPressed: () async {
                              final changed = await _showCustomerUpsertDialog(
                                context,
                                backendApiClient: backendApiClient,
                                session: session,
                                existingCustomer: customer,
                              );
                              if (changed && context.mounted) {
                                Navigator.of(context).pop(true);
                              }
                            },
                            icon: const Icon(Icons.edit_rounded),
                            label: const Text('Edit customer'),
                          ),
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
                          if (customer.balance > 0.009)
                            FilledButton.tonalIcon(
                              onPressed: () async {
                                final changed = await _showLedgerMutationDialog(
                                  context,
                                  backendApiClient: backendApiClient,
                                  session: session,
                                  customer: customer,
                                  initialEventType: 'payment',
                                  initialAmount: customer.balance,
                                  initialNote:
                                      'Full settlement from mobile ledger',
                                );
                                if (changed == true && context.mounted) {
                                  Navigator.of(context).pop(true);
                                }
                              },
                              icon: const Icon(Icons.payments_rounded),
                              label: const Text('Settle full due'),
                            ),
                        ],
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
    String initialEventType = 'payment',
    double? initialAmount,
    String? initialNote,
  }) async {
    final amountController = TextEditingController(
      text: initialAmount == null ? '' : initialAmount.toStringAsFixed(2),
    );
    final noteController = TextEditingController(text: initialNote ?? '');
    var eventType = initialEventType;

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
                    Text(
                      'Current balance ${formatCurrency(customer.balance)}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.68),
                        fontWeight: FontWeight.w700,
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
                        helperText: eventType == 'payment'
                            ? 'Payments reduce the customer due balance.'
                            : 'Positive adds receivable, negative reduces it.',
                      ),
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: <Widget>[
                        if (eventType == 'payment' && customer.balance > 0.009)
                          _LedgerAmountPresetChip(
                            label: 'Full due',
                            onTap: () {
                              amountController.text = customer.balance
                                  .toStringAsFixed(2);
                            },
                          ),
                        if (eventType == 'payment' && customer.balance > 0.009)
                          _LedgerAmountPresetChip(
                            label: 'Half due',
                            onTap: () {
                              amountController.text = (customer.balance / 2)
                                  .toStringAsFixed(2);
                            },
                          ),
                        _LedgerAmountPresetChip(
                          label: '₹500',
                          onTap: () {
                            amountController.text = '500';
                          },
                        ),
                        _LedgerAmountPresetChip(
                          label: '₹1000',
                          onTap: () {
                            amountController.text = '1000';
                          },
                        ),
                      ],
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

  Future<bool> _showCustomerUpsertDialog(
    BuildContext context, {
    required BackendApiClient backendApiClient,
    required MobileSession session,
    BackendCustomerSummary? existingCustomer,
  }) async {
    final nameController = TextEditingController(text: existingCustomer?.name);
    final phoneController = TextEditingController(
      text: existingCustomer?.phone,
    );
    final emailController = TextEditingController(
      text: existingCustomer?.email,
    );
    final notesController = TextEditingController(
      text: existingCustomer?.notes,
    );
    final openingBalanceController = TextEditingController();
    var status = existingCustomer?.status ?? 'active';
    var saving = false;

    try {
      final result = await showDialog<bool>(
        context: context,
        builder: (dialogContext) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: Text(
                  existingCustomer == null
                      ? 'Create migrated customer'
                      : 'Edit ${existingCustomer.name}',
                ),
                content: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      TextField(
                        controller: nameController,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(
                          labelText: 'Customer name',
                        ),
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
                        decoration: const InputDecoration(labelText: 'Email'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: notesController,
                        minLines: 2,
                        maxLines: 3,
                        decoration: const InputDecoration(labelText: 'Notes'),
                      ),
                      if (existingCustomer == null) ...<Widget>[
                        const SizedBox(height: 12),
                        TextField(
                          controller: openingBalanceController,
                          keyboardType: const TextInputType.numberWithOptions(
                            signed: true,
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'Opening balance (optional)',
                          ),
                        ),
                      ] else ...<Widget>[
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          initialValue: status,
                          items: const <DropdownMenuItem<String>>[
                            DropdownMenuItem(
                              value: 'active',
                              child: Text('Active'),
                            ),
                            DropdownMenuItem(
                              value: 'inactive',
                              child: Text('Inactive'),
                            ),
                          ],
                          onChanged: (value) {
                            if (value == null) {
                              return;
                            }
                            setDialogState(() {
                              status = value;
                            });
                          },
                          decoration: const InputDecoration(
                            labelText: 'Status',
                          ),
                        ),
                      ],
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
                            final name = nameController.text.trim();
                            if (name.isEmpty) {
                              ScaffoldMessenger.of(dialogContext).showSnackBar(
                                const SnackBar(
                                  content: Text('Customer name is required.'),
                                ),
                              );
                              return;
                            }

                            setDialogState(() {
                              saving = true;
                            });

                            try {
                              if (existingCustomer == null) {
                                await backendApiClient.createCustomer(
                                  user: session.user,
                                  shopId: session.shopId!,
                                  name: name,
                                  phone: phoneController.text.trim(),
                                  email: emailController.text.trim(),
                                  notes: notesController.text.trim(),
                                  openingBalance:
                                      double.tryParse(
                                        openingBalanceController.text.trim(),
                                      ) ??
                                      0,
                                );
                              } else {
                                await backendApiClient.updateCustomer(
                                  user: session.user,
                                  shopId: session.shopId!,
                                  customerId: existingCustomer.id,
                                  name: name,
                                  phone: phoneController.text.trim(),
                                  email: emailController.text.trim(),
                                  notes: notesController.text.trim(),
                                  status: status,
                                );
                              }
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
                                      'Customer save failed: $error',
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
                        : Text(existingCustomer == null ? 'Create' : 'Save'),
                  ),
                ],
              );
            },
          );
        },
      );
      return result == true;
    } finally {
      nameController.dispose();
      phoneController.dispose();
      emailController.dispose();
      notesController.dispose();
      openingBalanceController.dispose();
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

class _CustomerFilterChip extends StatelessWidget {
  const _CustomerFilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final accent = const Color(0xFF14B8A6);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Ink(
          decoration: BoxDecoration(
            color: active
                ? accent.withValues(alpha: 0.16)
                : Colors.white.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active
                  ? accent.withValues(alpha: 0.52)
                  : Colors.white.withValues(alpha: 0.06),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(
              label,
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: active ? accent : Colors.white.withValues(alpha: 0.78),
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CustomerSummaryTile extends StatelessWidget {
  const _CustomerSummaryTile({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: tone.withValues(alpha: 0.18)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: Colors.white.withValues(alpha: 0.58),
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: tone,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CollectionsQueuePanel extends StatelessWidget {
  const _CollectionsQueuePanel({
    required this.customers,
    required this.onSelectCustomer,
  });

  final List<BackendCustomerSummary> customers;
  final Future<void> Function(BackendCustomerSummary customer) onSelectCustomer;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFFF59E0B).withValues(alpha: 0.18),
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'Collections queue',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              'These customers currently carry the highest visible due balances.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.62),
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 14),
            ...customers
                .take(3)
                .map(
                  (customer) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(18),
                        onTap: () async {
                          await onSelectCustomer(customer);
                        },
                        child: Ink(
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.03),
                            borderRadius: BorderRadius.circular(18),
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
                                        customer.name,
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleSmall
                                            ?.copyWith(
                                              fontWeight: FontWeight.w800,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        customer.phone ??
                                            customer.email ??
                                            'Tap to open ledger',
                                        style: Theme.of(context)
                                            .textTheme
                                            .bodySmall
                                            ?.copyWith(
                                              color: Colors.white.withValues(
                                                alpha: 0.58,
                                              ),
                                              fontWeight: FontWeight.w600,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                MobileTag(
                                  label: formatCurrency(customer.balance),
                                  icon: Icons.account_balance_wallet_rounded,
                                  accent: const Color(0xFFF59E0B),
                                ),
                              ],
                            ),
                          ),
                        ),
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

class _LedgerAmountPresetChip extends StatelessWidget {
  const _LedgerAmountPresetChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _CustomerFilterChip(label: label, active: false, onTap: onTap);
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

class _BackendCustomerSummaryReport {
  const _BackendCustomerSummaryReport({
    required this.visibleCount,
    required this.dueCount,
    required this.inactiveCount,
    required this.receivableBalance,
    required this.highestBalanceCustomer,
    required this.collectionsQueue,
  });

  final int visibleCount;
  final int dueCount;
  final int inactiveCount;
  final double receivableBalance;
  final BackendCustomerSummary? highestBalanceCustomer;
  final List<BackendCustomerSummary> collectionsQueue;

  factory _BackendCustomerSummaryReport.fromCustomers(
    List<BackendCustomerSummary> customers,
  ) {
    var dueCount = 0;
    var inactiveCount = 0;
    var receivableBalance = 0.0;
    BackendCustomerSummary? highestBalanceCustomer;
    final dueCustomers = <BackendCustomerSummary>[];

    for (final customer in customers) {
      if (customer.balance > 0.009) {
        dueCount += 1;
        receivableBalance += customer.balance;
        dueCustomers.add(customer);
        if (highestBalanceCustomer == null ||
            customer.balance > highestBalanceCustomer.balance) {
          highestBalanceCustomer = customer;
        }
      }
      if (customer.status.toLowerCase() != 'active') {
        inactiveCount += 1;
      }
    }

    return _BackendCustomerSummaryReport(
      visibleCount: customers.length,
      dueCount: dueCount,
      inactiveCount: inactiveCount,
      receivableBalance: receivableBalance,
      highestBalanceCustomer: highestBalanceCustomer,
      collectionsQueue:
          (dueCustomers
                ..sort((left, right) => right.balance.compareTo(left.balance)))
              .take(3)
              .toList(growable: false),
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

class _CustomerStatusFilterOption {
  const _CustomerStatusFilterOption({required this.value, required this.label});

  final String value;
  final String label;
}

const List<_CustomerStatusFilterOption> _customerStatusFilters =
    <_CustomerStatusFilterOption>[
      _CustomerStatusFilterOption(value: 'all', label: 'All'),
      _CustomerStatusFilterOption(value: 'with_due', label: 'With due'),
      _CustomerStatusFilterOption(value: 'active_only', label: 'Active'),
      _CustomerStatusFilterOption(value: 'inactive_only', label: 'Inactive'),
    ];

const List<_CustomerStatusFilterOption> _customerSortModes =
    <_CustomerStatusFilterOption>[
      _CustomerStatusFilterOption(value: 'due_desc', label: 'Due high'),
      _CustomerStatusFilterOption(value: 'spent_desc', label: 'Spent high'),
      _CustomerStatusFilterOption(value: 'name_asc', label: 'A-Z'),
    ];
