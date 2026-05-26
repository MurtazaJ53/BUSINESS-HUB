import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/database/mobile_repository.dart';
import '../../../core/insights/mobile_operational_insights.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/providers/mobile_data_providers.dart';
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

  void _resetFilters() {
    _searchController.clear();
    setState(() {
      _search = '';
      _statusFilter = 'all';
      _sortMode = 'due_desc';
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final salesRepository = ref.watch(salesRepositoryProvider);
    final shopRepository = ref.watch(shopRepositoryProvider);
    final customerRepository = ref.watch(customerRepositoryProvider);
    final backendApiClient = ref.watch(backendApiClientProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final customerPulseStream = salesRepository.watchCustomerPulse(
      search: _search,
    );
    final legacyCustomersStream = customerRepository.watchLegacyCustomers(
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
            final roleProfile = _CustomersRoleProfile.fromSession(
              session: session,
              domainState: domainState,
              ledgerDomainState: ledgerDomainState,
              history: history,
              syncStatus: syncStatus,
            );
            final hasActiveFilters =
                _search.trim().isNotEmpty ||
                _statusFilter != 'all' ||
                _sortMode != 'due_desc';
            final backendFuture = _resolveBackendLookupFuture(
              backendApiClient: backendApiClient,
              session: session,
              domainState: domainState,
            );

            return ListView(
              padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
              children: <Widget>[
                MobileScreenLead(
                  title: roleProfile.leadTitle,
                  subtitle: roleProfile.leadSubtitle,
                  icon: roleProfile.leadIcon,
                  accent: roleProfile.leadAccent,
                  primaryTag: MobileTag(
                    label: roleProfile.primaryTagLabel,
                    icon: roleProfile.primaryTagIcon,
                    accent: roleProfile.primaryTagAccent,
                  ),
                  secondaryTag: MobileTag(
                    label: roleProfile.secondaryTagLabel,
                    icon: roleProfile.secondaryTagIcon,
                    accent: roleProfile.secondaryTagAccent,
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
                          label: 'Customer mode',
                          value: domainState.isPostgresPrimary
                              ? 'Ledger live'
                              : 'Recall mode',
                          caption: domainState.isPostgresPrimary
                              ? 'Backend customer master'
                              : 'Legacy and local recall',
                          icon: Icons.groups_rounded,
                          accent: const Color(0xFF4EB79B),
                        ),
                        MobileMetricCard(
                          label: 'Ledger',
                          value: ledgerDomainState.isPostgresPrimary
                              ? 'Writable'
                              : 'Read only',
                          caption: ledgerDomainState.isPostgresPrimary
                              ? 'Payments and adjustments'
                              : 'Browse and review only',
                          icon: Icons.account_balance_wallet_rounded,
                          accent: ledgerDomainState.isPostgresPrimary
                              ? const Color(0xFF4EB79B)
                              : const Color(0xFFF0C879),
                        ),
                        MobileMetricCard(
                          label: 'Known sales',
                          value: '${history.totalSales}',
                          caption: history.totalSales > 0
                              ? '${history.queuedSales} queued receipt${history.queuedSales == 1 ? '' : 's'}'
                              : 'Awaiting local history',
                          icon: Icons.receipt_long_rounded,
                          accent: const Color(0xFFE58A47),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 18),
                MobilePanel(
                  title: roleProfile.searchPanelTitle,
                  action: MobileTag(
                    label: _statusFilter == 'all'
                        ? (_search.isEmpty ? 'ALL BUYERS' : 'FILTERED')
                        : _statusFilter.replaceAll('_', ' ').toUpperCase(),
                    icon: Icons.manage_search_rounded,
                    accent: const Color(0xFF4EB79B),
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
                      if (hasActiveFilters) ...<Widget>[
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: <Widget>[
                            if (_search.trim().isNotEmpty)
                              MobileTag(
                                label: 'Search: ${_search.trim()}',
                                icon: Icons.search_rounded,
                                accent: const Color(0xFFE58A47),
                              ),
                            if (_statusFilter != 'all')
                              MobileTag(
                                label: _customerStatusFilters
                                    .firstWhere(
                                      (filter) => filter.value == _statusFilter,
                                    )
                                    .label,
                                icon: Icons.filter_alt_rounded,
                                accent: const Color(0xFF4EB79B),
                              ),
                            if (_sortMode != 'due_desc')
                              MobileTag(
                                label: _customerSortModes
                                    .firstWhere(
                                      (sort) => sort.value == _sortMode,
                                    )
                                    .label,
                                icon: Icons.sort_rounded,
                                accent: const Color(0xFF7CA4F8),
                              ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: FilledButton.tonalIcon(
                            onPressed: _resetFilters,
                            icon: const Icon(Icons.restart_alt_rounded),
                            label: const Text('Clear filters'),
                          ),
                        ),
                      ],
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
                      label: const Text('Create customer'),
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
                          title: 'Customer accounts',
                          child: MobileEmptyState(
                            icon: Icons.sync_rounded,
                            title: 'Loading customer accounts',
                            body:
                                'The mobile desk is pulling live customer balances from the backend.',
                          ),
                        );
                      }

                      if (snapshot.hasError) {
                        return _LocalCustomersFallbackPanel(
                          shop: shop,
                          legacyCustomersStream: legacyCustomersStream,
                          customerPulseStream: customerPulseStream,
                          statusFilter: _statusFilter,
                          sortMode: _sortMode,
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
                          title: 'Customer accounts',
                          child: Column(
                            children: <Widget>[
                              const MobileEmptyState(
                                icon: Icons.groups_outlined,
                                title: 'No customers matched',
                                body:
                                    'The live customer account list is ready, but no records matched the current lookup.',
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
                                  label: const Text('Create customer'),
                                ),
                              ],
                            ],
                          ),
                        );
                      }

                      final orderedCustomers = sortBackendCustomers(
                        filteredCustomers,
                        sortMode: _sortMode,
                      );
                      final summary =
                          BackendCustomerOperationalReport.fromCustomers(
                            orderedCustomers,
                          );
                      final showFinanceSummary = shop.supportsFinanceSummary;
                      final showCollectionsQueue =
                          shop.normalizedPlanTier != 'starter';
                      return MobilePanel(
                        title: 'Customer accounts',
                        action: MobileTag(
                          label: '${orderedCustomers.length} live',
                          icon: Icons.verified_rounded,
                          accent: const Color(0xFF4EB79B),
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
                                    tone: const Color(0xFF4EB79B),
                                  ),
                                  _CustomerSummaryTile(
                                    label: 'With due',
                                    value: '${summary.dueCount}',
                                    tone: const Color(0xFFEF6B67),
                                  ),
                                  if (showFinanceSummary)
                                    _CustomerSummaryTile(
                                      label: 'Receivable',
                                      value: formatCurrency(
                                        summary.receivableBalance,
                                      ),
                                      tone: summary.receivableBalance > 0
                                          ? const Color(0xFFF0C879)
                                          : const Color(0xFF4EB79B),
                                    ),
                                  if (showFinanceSummary)
                                    _CustomerSummaryTile(
                                      label: 'Inactive',
                                      value: '${summary.inactiveCount}',
                                      tone: const Color(0xFF7CA4F8),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 14),
                              Text(
                                summary.highestBalanceCustomer == null
                                    ? 'No customer currently holds a due balance.'
                                    : showFinanceSummary
                                    ? 'Highest due: ${summary.highestBalanceCustomer!.name} | ${formatCurrency(summary.highestBalanceCustomer!.balance)}'
                                    : '${shop.planLabel} keeps account review lighter. Upgrade to Pro for full receivable rollups.',
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(
                                      color: Colors.white.withValues(
                                        alpha: 0.62,
                                      ),
                                      fontWeight: FontWeight.w600,
                                    ),
                              ),
                              const SizedBox(height: 14),
                              if (showCollectionsQueue &&
                                  summary.collectionsQueue.isNotEmpty)
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
                              if (showCollectionsQueue &&
                                  summary.collectionsQueue.isNotEmpty)
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
                    shop: shop,
                    legacyCustomersStream: legacyCustomersStream,
                    customerPulseStream: customerPulseStream,
                    statusFilter: _statusFilter,
                    sortMode: _sortMode,
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
                    MobileSheetHeader(
                      title: customer.name,
                      subtitle:
                          customer.phone ??
                          customer.email ??
                          'No contact recorded',
                      icon: Icons.groups_rounded,
                      accent: const Color(0xFF4EB79B),
                      tags: <Widget>[
                        MobileTag(
                          label: 'Balance ${formatCurrency(customer.balance)}',
                          icon: Icons.account_balance_wallet_rounded,
                          accent: customer.balance > 0
                              ? const Color(0xFFEF6B67)
                              : const Color(0xFF4EB79B),
                        ),
                        MobileTag(
                          label: 'Spent ${formatCurrency(customer.totalSpent)}',
                          icon: Icons.trending_up_rounded,
                          accent: const Color(0xFFE58A47),
                        ),
                      ],
                    ),
                    if (ledgerDomainState.isPostgresPrimary) ...<Widget>[
                      const SizedBox(height: 14),
                      MobileSheetSection(
                        title: 'Customer actions',
                        accent: const Color(0xFF4EB79B),
                        child: Wrap(
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
                                  final changed =
                                      await _showLedgerMutationDialog(
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
                      MobileSheetSection(
                        title: 'Recent ledger entries',
                        accent: const Color(0xFF7CA4F8),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxHeight: 320),
                          child: ListView(
                            shrinkWrap: true,
                            children: entries
                                .map(
                                  (entry) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: DecoratedBox(
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(
                                          alpha: 0.03,
                                        ),
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
                                                        ? const Color(
                                                            0xFFEF6B67,
                                                          )
                                                        : const Color(
                                                            0xFF4EB79B,
                                                          ),
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
              final compact = MediaQuery.sizeOf(context).width < 420;
              return Dialog(
                backgroundColor: Colors.transparent,
                insetPadding: EdgeInsets.symmetric(
                  horizontal: compact ? 16 : 24,
                  vertical: 24,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF07111E),
                    borderRadius: BorderRadius.circular(compact ? 24 : 28),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                    boxShadow: const <BoxShadow>[
                      BoxShadow(
                        color: Color(0x55000000),
                        blurRadius: 28,
                        offset: Offset(0, 18),
                      ),
                    ],
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 540),
                    child: SingleChildScrollView(
                      padding: EdgeInsets.all(compact ? 18 : 22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          MobileSheetHeader(
                            eyebrow: 'Customer ledger',
                            title: 'Update ${customer.name}',
                            subtitle:
                                'Record a payment or adjust the visible due balance without leaving the customer flow.',
                            icon: eventType == 'payment'
                                ? Icons.payments_rounded
                                : Icons.tune_rounded,
                            accent: eventType == 'payment'
                                ? const Color(0xFF4EB79B)
                                : const Color(0xFFF0C879),
                            tags: <Widget>[
                              MobileTag(
                                label:
                                    'Balance ${formatCurrency(customer.balance)}',
                                icon: Icons.account_balance_wallet_rounded,
                                accent: customer.balance > 0
                                    ? const Color(0xFFEF6B67)
                                    : const Color(0xFF4EB79B),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          MobileSheetSection(
                            title: 'Entry details',
                            child: Column(
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
                                  keyboardType:
                                      const TextInputType.numberWithOptions(
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
                                    if (eventType == 'payment' &&
                                        customer.balance > 0.009)
                                      _LedgerAmountPresetChip(
                                        label: 'Full due',
                                        onTap: () {
                                          amountController.text = customer
                                              .balance
                                              .toStringAsFixed(2);
                                        },
                                      ),
                                    if (eventType == 'payment' &&
                                        customer.balance > 0.009)
                                      _LedgerAmountPresetChip(
                                        label: 'Half due',
                                        onTap: () {
                                          amountController.text =
                                              (customer.balance / 2)
                                                  .toStringAsFixed(2);
                                        },
                                      ),
                                    _LedgerAmountPresetChip(
                                      label: 'Rs 500',
                                      onTap: () {
                                        amountController.text = '500';
                                      },
                                    ),
                                    _LedgerAmountPresetChip(
                                      label: 'Rs 1000',
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
                                  decoration: const InputDecoration(
                                    labelText: 'Note',
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () =>
                                      Navigator.of(dialogContext).pop(false),
                                  child: const Text('Cancel'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton(
                                  onPressed: () async {
                                    final rawAmount =
                                        double.tryParse(
                                          amountController.text.trim(),
                                        ) ??
                                        0;
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
                                      await backendApiClient
                                          .createCustomerLedgerEntry(
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
                                        ScaffoldMessenger.of(
                                          dialogContext,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text(
                                              'Ledger update failed: $error',
                                            ),
                                          ),
                                        );
                                      }
                                    }
                                  },
                                  child: Text(
                                    eventType == 'payment'
                                        ? 'Record payment'
                                        : 'Save adjustment',
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
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
              final compact = MediaQuery.sizeOf(context).width < 420;
              return Dialog(
                backgroundColor: Colors.transparent,
                insetPadding: EdgeInsets.symmetric(
                  horizontal: compact ? 16 : 24,
                  vertical: 24,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: const Color(0xFF07111E),
                    borderRadius: BorderRadius.circular(compact ? 24 : 28),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.06),
                    ),
                    boxShadow: const <BoxShadow>[
                      BoxShadow(
                        color: Color(0x55000000),
                        blurRadius: 28,
                        offset: Offset(0, 18),
                      ),
                    ],
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 540),
                    child: SingleChildScrollView(
                      padding: EdgeInsets.all(compact ? 18 : 22),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          MobileSheetHeader(
                            eyebrow: existingCustomer == null
                                ? 'New customer'
                                : 'Edit customer',
                            title: existingCustomer == null
                                ? 'Create migrated customer'
                                : 'Edit ${existingCustomer.name}',
                            subtitle: existingCustomer == null
                                ? 'Add a buyer profile that will sync into the migrated customer path.'
                                : 'Keep contact details and account posture updated without leaving the customer list.',
                            icon: existingCustomer == null
                                ? Icons.person_add_alt_1_rounded
                                : Icons.edit_note_rounded,
                            accent: const Color(0xFF4EB79B),
                            tags: <Widget>[
                              if (existingCustomer != null)
                                MobileTag(
                                  label: existingCustomer.status.toUpperCase(),
                                  icon: existingCustomer.status == 'active'
                                      ? Icons.verified_user_rounded
                                      : Icons.pause_circle_rounded,
                                  accent: existingCustomer.status == 'active'
                                      ? const Color(0xFF4EB79B)
                                      : const Color(0xFFF0C879),
                                )
                              else
                                const MobileTag(
                                  label: 'Bridge customer',
                                  icon: Icons.cloud_sync_rounded,
                                  accent: Color(0xFFE58A47),
                                ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          MobileSheetSection(
                            title: 'Profile details',
                            child: Column(
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
                                  decoration: const InputDecoration(
                                    labelText: 'Phone',
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: emailController,
                                  keyboardType: TextInputType.emailAddress,
                                  decoration: const InputDecoration(
                                    labelText: 'Email',
                                  ),
                                ),
                                const SizedBox(height: 12),
                                TextField(
                                  controller: notesController,
                                  minLines: 2,
                                  maxLines: 3,
                                  decoration: const InputDecoration(
                                    labelText: 'Notes',
                                  ),
                                ),
                                if (existingCustomer == null) ...<Widget>[
                                  const SizedBox(height: 12),
                                  TextField(
                                    controller: openingBalanceController,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
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
                          const SizedBox(height: 16),
                          Row(
                            children: <Widget>[
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: saving
                                      ? null
                                      : () => Navigator.of(
                                          dialogContext,
                                        ).pop(false),
                                  child: const Text('Cancel'),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: FilledButton(
                                  onPressed: saving
                                      ? null
                                      : () async {
                                          final name = nameController.text
                                              .trim();
                                          if (name.isEmpty) {
                                            ScaffoldMessenger.of(
                                              dialogContext,
                                            ).showSnackBar(
                                              const SnackBar(
                                                content: Text(
                                                  'Customer name is required.',
                                                ),
                                              ),
                                            );
                                            return;
                                          }

                                          setDialogState(() {
                                            saving = true;
                                          });

                                          try {
                                            if (existingCustomer == null) {
                                              await backendApiClient
                                                  .createCustomer(
                                                    user: session.user,
                                                    shopId: session.shopId!,
                                                    name: name,
                                                    phone: phoneController.text
                                                        .trim(),
                                                    email: emailController.text
                                                        .trim(),
                                                    notes: notesController.text
                                                        .trim(),
                                                    openingBalance:
                                                        double.tryParse(
                                                          openingBalanceController
                                                              .text
                                                              .trim(),
                                                        ) ??
                                                        0,
                                                  );
                                            } else {
                                              await backendApiClient
                                                  .updateCustomer(
                                                    user: session.user,
                                                    shopId: session.shopId!,
                                                    customerId:
                                                        existingCustomer.id,
                                                    name: name,
                                                    phone: phoneController.text
                                                        .trim(),
                                                    email: emailController.text
                                                        .trim(),
                                                    notes: notesController.text
                                                        .trim(),
                                                    status: status,
                                                  );
                                            }
                                            if (dialogContext.mounted) {
                                              Navigator.of(
                                                dialogContext,
                                              ).pop(true);
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
                                          } finally {
                                            setDialogState(() {
                                              saving = false;
                                            });
                                          }
                                        },
                                  child: saving
                                      ? const SizedBox(
                                          width: 18,
                                          height: 18,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Text(
                                          existingCustomer == null
                                              ? 'Create customer'
                                              : 'Save changes',
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
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

class _CustomersRoleProfile {
  const _CustomersRoleProfile({
    required this.leadTitle,
    required this.leadSubtitle,
    required this.leadIcon,
    required this.leadAccent,
    required this.primaryTagLabel,
    required this.primaryTagIcon,
    required this.primaryTagAccent,
    required this.secondaryTagLabel,
    required this.secondaryTagIcon,
    required this.secondaryTagAccent,
    required this.searchPanelTitle,
  });

  final String leadTitle;
  final String leadSubtitle;
  final IconData leadIcon;
  final Color leadAccent;
  final String primaryTagLabel;
  final IconData primaryTagIcon;
  final Color primaryTagAccent;
  final String secondaryTagLabel;
  final IconData secondaryTagIcon;
  final Color secondaryTagAccent;
  final String searchPanelTitle;

  factory _CustomersRoleProfile.fromSession({
    required MobileSession? session,
    required DomainControlState domainState,
    required DomainControlState ledgerDomainState,
    required HistoryOverview history,
    required MobileSyncStatus syncStatus,
  }) {
    final primaryLabel = domainState.isPostgresPrimary
        ? 'Live customer mode'
        : 'Bridge customer mode';
    final primaryIcon = domainState.isPostgresPrimary
        ? Icons.verified_rounded
        : Icons.swap_horiz_rounded;
    final primaryAccent = domainState.isPostgresPrimary
        ? const Color(0xFF4EB79B)
        : const Color(0xFF4EB79B);
    final secondaryLabel = history.totalSales > 0
        ? '${history.totalSales} receipts known'
        : (syncStatus == MobileSyncStatus.syncing
              ? 'Refreshing history'
              : 'Awaiting local history');
    final secondaryIcon = history.totalSales > 0
        ? Icons.receipt_long_rounded
        : syncStatus == MobileSyncStatus.syncing
        ? Icons.sync_rounded
        : Icons.schedule_rounded;
    final secondaryAccent = const Color(0xFFE58A47);

    if (session?.isCashierLike ?? false) {
      return _CustomersRoleProfile(
        leadTitle: ledgerDomainState.isPostgresPrimary
            ? 'Find buyers and dues fast'
            : 'Buyer recall is ready',
        leadSubtitle: ledgerDomainState.isPostgresPrimary
            ? 'Check buyer balances, attach the right customer, and review dues without leaving the floor flow.'
            : 'Search old cloud buyers and local sales recall while the live customer ledger finishes rolling out.',
        leadIcon: Icons.groups_rounded,
        leadAccent: const Color(0xFF4EB79B),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: primaryIcon,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: secondaryIcon,
        secondaryTagAccent: secondaryAccent,
        searchPanelTitle: 'Find buyers',
      );
    }

    if (session?.isManager ?? false) {
      return _CustomersRoleProfile(
        leadTitle: domainState.isPostgresPrimary
            ? 'Customer balances are live'
            : 'Customer bridge is active',
        leadSubtitle:
            'Track buyer accounts, receivables, and follow-up queues from a cleaner customer view.',
        leadIcon: Icons.groups_rounded,
        leadAccent: const Color(0xFF4EB79B),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: primaryIcon,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: secondaryIcon,
        secondaryTagAccent: secondaryAccent,
        searchPanelTitle: 'Find customer accounts',
      );
    }

    return _CustomersRoleProfile(
      leadTitle: domainState.isPostgresPrimary
          ? 'Customer accounts are live'
          : 'Customer bridge is active',
      leadSubtitle:
          'Review buyer balances, receivables, and collections without exposing heavy ERP behavior to daily users.',
      leadIcon: Icons.groups_rounded,
      leadAccent: const Color(0xFF4EB79B),
      primaryTagLabel: primaryLabel,
      primaryTagIcon: primaryIcon,
      primaryTagAccent: primaryAccent,
      secondaryTagLabel: secondaryLabel,
      secondaryTagIcon: secondaryIcon,
      secondaryTagAccent: secondaryAccent,
      searchPanelTitle: 'Find customer accounts',
    );
  }
}

class _LocalCustomersFallbackPanel extends StatelessWidget {
  const _LocalCustomersFallbackPanel({
    required this.shop,
    required this.legacyCustomersStream,
    required this.customerPulseStream,
    required this.statusFilter,
    required this.sortMode,
    this.warning,
  });

  final ShopInfo shop;
  final Stream<List<BackendCustomerSummary>> legacyCustomersStream;
  final Stream<List<CustomerPulseSummary>> customerPulseStream;
  final String statusFilter;
  final String sortMode;
  final String? warning;

  Future<void> _showLegacyCustomerDetailSheet(
    BuildContext context,
    BackendCustomerSummary customer,
  ) {
    final compact = MediaQuery.sizeOf(context).width < 420;
    final balanceAccent = customer.balance > 0
        ? const Color(0xFFEF6B67)
        : const Color(0xFF4EB79B);
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (sheetContext) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.only(
              left: compact ? 16 : 18,
              right: compact ? 16 : 18,
              top: compact ? 16 : 18,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                MobileSheetHeader(
                  eyebrow: 'Legacy customer',
                  title: customer.name,
                  subtitle:
                      customer.phone ??
                      customer.email ??
                      'Loaded from the old cloud customer collection.',
                  icon: Icons.cloud_sync_rounded,
                  accent: const Color(0xFF4EB79B),
                  tags: <Widget>[
                    MobileTag(
                      label: 'Spent ${formatCurrency(customer.totalSpent)}',
                      icon: Icons.trending_up_rounded,
                      accent: const Color(0xFFE58A47),
                    ),
                    MobileTag(
                      label: 'Balance ${formatCurrency(customer.balance)}',
                      icon: Icons.account_balance_wallet_rounded,
                      accent: balanceAccent,
                    ),
                    MobileTag(
                      label: customer.status.toUpperCase(),
                      icon: Icons.verified_rounded,
                      accent: const Color(0xFF7CA4F8),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                MobileSheetSection(
                  title: 'Customer snapshot',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _CustomerDetailLine(
                        label: 'Phone',
                        value: customer.phone,
                      ),
                      _CustomerDetailLine(
                        label: 'Email',
                        value: customer.email,
                      ),
                      _CustomerDetailLine(
                        label: 'Status',
                        value: customer.status,
                      ),
                      _CustomerDetailLine(
                        label: 'Lifetime spent',
                        value: formatCurrency(customer.totalSpent),
                      ),
                      _CustomerDetailLine(
                        label: 'Current balance',
                        value: formatCurrency(customer.balance),
                      ),
                    ],
                  ),
                ),
                if ((customer.notes ?? '').trim().isNotEmpty) ...<Widget>[
                  const SizedBox(height: 12),
                  MobileSheetSection(
                    title: 'Notes',
                    child: Text(customer.notes!.trim()),
                  ),
                ],
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.of(sheetContext).pop(),
                        icon: const Icon(Icons.arrow_back_rounded),
                        label: const Text('Back to customers'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _showLocalCustomerDetailSheet(
    BuildContext context,
    CustomerPulseSummary customer,
  ) {
    final compact = MediaQuery.sizeOf(context).width < 420;
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (sheetContext) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: EdgeInsets.only(
              left: compact ? 16 : 18,
              right: compact ? 16 : 18,
              top: compact ? 16 : 18,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 20,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                MobileSheetHeader(
                  eyebrow: 'Local buyer recall',
                  title: customer.name,
                  subtitle:
                      customer.phone ??
                      'Rebuilt from local sales history because the cloud customer master is empty for this view.',
                  icon: Icons.person_search_rounded,
                  accent: const Color(0xFF4EB79B),
                  tags: <Widget>[
                    MobileTag(
                      label: '${customer.visitCount} visits',
                      icon: Icons.repeat_rounded,
                      accent: const Color(0xFFE58A47),
                    ),
                    MobileTag(
                      label: 'Spent ${formatCurrency(customer.lifetimeSpend)}',
                      icon: Icons.currency_rupee_rounded,
                      accent: const Color(0xFF4EB79B),
                    ),
                    if (customer.pendingSales > 0)
                      MobileTag(
                        label: '${customer.pendingSales} queued',
                        icon: Icons.cloud_upload_rounded,
                        accent: const Color(0xFFF0C879),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                MobileSheetSection(
                  title: 'Buyer snapshot',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _CustomerDetailLine(
                        label: 'Phone',
                        value: customer.phone,
                      ),
                      _CustomerDetailLine(
                        label: 'Last seen',
                        value: formatCompactDate(customer.lastSeenAt),
                      ),
                      _CustomerDetailLine(
                        label: 'Visits',
                        value: '${customer.visitCount}',
                      ),
                      _CustomerDetailLine(
                        label: 'Lifetime spend',
                        value: formatCurrency(customer.lifetimeSpend),
                      ),
                      _CustomerDetailLine(
                        label: 'Queued receipts',
                        value: '${customer.pendingSales}',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.of(sheetContext).pop(),
                        icon: const Icon(Icons.arrow_back_rounded),
                        label: const Text('Back to customers'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return MobilePanel(
      title: 'Local buyer bridge',
      action: MobileTag(
        label: 'FIRESTORE',
        icon: Icons.cloud_done_rounded,
        accent: const Color(0xFF4EB79B),
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
                  color: const Color(0xFFF0C879).withValues(alpha: 0.16),
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
          StreamBuilder<List<BackendCustomerSummary>>(
            stream: legacyCustomersStream,
            builder: (context, snapshot) {
              final legacyCustomers =
                  snapshot.data ?? const <BackendCustomerSummary>[];
              final filteredLegacyCustomers = sortBackendCustomers(
                legacyCustomers
                    .where(_matchesLegacyFilter)
                    .toList(growable: false),
                sortMode: sortMode,
              );

              if (filteredLegacyCustomers.isNotEmpty) {
                final summary = BackendCustomerOperationalReport.fromCustomers(
                  filteredLegacyCustomers,
                );
                final showFinanceSummary = shop.supportsFinanceSummary;
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      'Customer records are loading from the old cloud collection for this shop.',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.68),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 14),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: <Widget>[
                        _CustomerSummaryTile(
                          label: 'Visible',
                          value: '${summary.visibleCount}',
                          tone: const Color(0xFF4EB79B),
                        ),
                        _CustomerSummaryTile(
                          label: 'With due',
                          value: '${summary.dueCount}',
                          tone: const Color(0xFFEF6B67),
                        ),
                        if (showFinanceSummary)
                          _CustomerSummaryTile(
                            label: 'Receivable',
                            value: formatCurrency(summary.receivableBalance),
                            tone: summary.receivableBalance > 0
                                ? const Color(0xFFF0C879)
                                : const Color(0xFF4EB79B),
                          ),
                        if (showFinanceSummary)
                          _CustomerSummaryTile(
                            label: 'Inactive',
                            value: '${summary.inactiveCount}',
                            tone: const Color(0xFF7CA4F8),
                          ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    if (summary.highestBalanceCustomer != null)
                      Text(
                        showFinanceSummary
                            ? 'Highest due: ${summary.highestBalanceCustomer!.name} | ${formatCurrency(summary.highestBalanceCustomer!.balance)}'
                            : '${shop.planLabel} keeps local customer recall lighter. Upgrade to Pro for full receivable rollups.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.62),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    if (summary.highestBalanceCustomer != null)
                      const SizedBox(height: 14),
                    ...filteredLegacyCustomers.map(
                      (customer) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _LegacyCloudCustomerRow(
                          customer: customer,
                          onTap: () =>
                              _showLegacyCustomerDetailSheet(context, customer),
                        ),
                      ),
                    ),
                  ],
                );
              }

              return StreamBuilder<List<CustomerPulseSummary>>(
                stream: customerPulseStream,
                builder: (context, pulseSnapshot) {
                  final customers =
                      pulseSnapshot.data ?? const <CustomerPulseSummary>[];
                  if (customers.isEmpty) {
                    return const MobileEmptyState(
                      icon: Icons.groups_outlined,
                      title: 'No known buyers matched',
                      body:
                          'No Firestore customer records or named local receipts matched this lookup yet.',
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'The cloud customer master is empty for this view, so the app is rebuilding buyer recall from local sales history.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.68),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 14),
                      ...customers.map(
                        (customer) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _LocalCustomerRow(
                            customer: customer,
                            onTap: () => _showLocalCustomerDetailSheet(
                              context,
                              customer,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              );
            },
          ),
        ],
      ),
    );
  }

  bool _matchesLegacyFilter(BackendCustomerSummary customer) {
    return switch (statusFilter) {
      'with_due' => customer.balance > 0.009,
      'active_only' => customer.status.toLowerCase() == 'active',
      'inactive_only' => customer.status.toLowerCase() != 'active',
      _ => true,
    };
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
    final accent = const Color(0xFF4EB79B);
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
        color: const Color(0xFF232A36),
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
        color: const Color(0xFF232A36),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: const Color(0xFFF0C879).withValues(alpha: 0.18),
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
                                  accent: const Color(0xFFF0C879),
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
        ? const Color(0xFFEF6B67)
        : const Color(0xFF4EB79B);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF232A36),
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
                    color: const Color(0xFF4EB79B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.groups_rounded,
                    color: Color(0xFF4EB79B),
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
                            accent: const Color(0xFFE58A47),
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

class _LegacyCloudCustomerRow extends StatelessWidget {
  const _LegacyCloudCustomerRow({required this.customer, required this.onTap});

  final BackendCustomerSummary customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final balanceTone = customer.balance > 0
        ? const Color(0xFFEF6B67)
        : const Color(0xFF4EB79B);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF232A36),
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
                    color: const Color(0xFF4EB79B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.cloud_sync_rounded,
                    color: Color(0xFF4EB79B),
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
                        customer.phone ??
                            customer.email ??
                            customer.notes ??
                            customer.status,
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
                            accent: const Color(0xFFE58A47),
                          ),
                          MobileTag(
                            label:
                                'Balance ${formatCurrency(customer.balance)}',
                            icon: Icons.account_balance_wallet_rounded,
                            accent: balanceTone,
                          ),
                          MobileTag(
                            label: customer.status.toUpperCase(),
                            icon: Icons.cloud_done_rounded,
                            accent: const Color(0xFF4EB79B),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white.withValues(alpha: 0.45),
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
  const _LocalCustomerRow({required this.customer, required this.onTap});

  final CustomerPulseSummary customer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Ink(
          decoration: BoxDecoration(
            color: const Color(0xFF232A36),
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
                    color: const Color(0xFF4EB79B).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(
                    Icons.person_search_rounded,
                    color: Color(0xFF4EB79B),
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
                            accent: const Color(0xFFE58A47),
                          ),
                          MobileTag(
                            label:
                                'Spent ${formatCurrency(customer.lifetimeSpend)}',
                            icon: Icons.currency_rupee_rounded,
                            accent: const Color(0xFF4EB79B),
                          ),
                          if (customer.pendingSales > 0)
                            MobileTag(
                              label: '${customer.pendingSales} queued',
                              icon: Icons.cloud_upload_rounded,
                              accent: const Color(0xFFF0C879),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Icon(
                  Icons.chevron_right_rounded,
                  color: Colors.white.withValues(alpha: 0.45),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CustomerDetailLine extends StatelessWidget {
  const _CustomerDetailLine({required this.label, required this.value});

  final String label;
  final String? value;

  @override
  Widget build(BuildContext context) {
    final safeValue = (value ?? '').trim().isEmpty ? 'Not available' : value!;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 112,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.56),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              safeValue,
              style: Theme.of(
                context,
              ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ],
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
