import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';

import '../../../core/checkout/checkout_policy.dart';
import '../../../core/backend/backend_api_client.dart';
import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import 'pos_scanner_sheet.dart';
import '../../shell/presentation/mobile_surface.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _customerController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _footerController = TextEditingController();

  final List<PosCartItem> _cart = <PosCartItem>[];

  BackendCustomerSummary? _selectedCustomer;
  String _search = '';
  String? _selectedCategory;
  String _paymentMode = 'CASH';
  bool _saving = false;
  int _page = 1;

  static const int _pageSize = 32;

  double get _cartTotal =>
      _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);

  @override
  void dispose() {
    _searchController.dispose();
    _customerController.dispose();
    _phoneController.dispose();
    _footerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final inventoryRepository = ref.read(inventoryRepositoryProvider);
    final salesRepository = ref.read(salesRepositoryProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final backendApiClient = ref.watch(backendApiClientProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final categories =
        ref.watch(inventoryCategoriesProvider).asData?.value ??
        const <InventoryCategorySummary>[];
    final pending = ref.watch(pendingOutboxCountProvider).asData?.value ?? 0;
    final customerDomainState =
        ref.watch(domainStateProvider('customers')).asData?.value ??
        DomainControlState.legacy('customers');
    final catalogFilter = PosCatalogFilter(
      search: _search,
      category: _selectedCategory,
      page: _page,
      pageSize: _pageSize,
      includeCost: session?.canViewCost ?? false,
    );
    final items =
        ref.watch(posCatalogPageProvider(catalogFilter)).asData?.value ??
        const <InventoryCatalogItem>[];
    final totalCount =
        ref.watch(posCatalogCountProvider(catalogFilter)).asData?.value ?? 0;
    final roleProfile = _PosRoleProfile.fromSession(
      session: session,
      cartCount: _cart.length,
      cartTotal: _cartTotal,
      pending: pending,
      syncStatus: syncStatus,
    );
    final totalPages = totalCount == 0 ? 1 : (totalCount / _pageSize).ceil();
    final compactActions = MediaQuery.sizeOf(context).width < 390;

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: _cart.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _openCartSheet(
                context,
                session: session,
                backendApiClient: backendApiClient,
                salesRepository: salesRepository,
                syncCoordinator: syncCoordinator,
                shop: shop,
                customerDomainState: customerDomainState,
                activeShopId: session?.shopId,
              ),
              backgroundColor: const Color(0xFF2563EB),
              icon: const Icon(Icons.shopping_bag_rounded),
              label: Text(
                'Checkout ${formatCurrency(_cartTotal)}',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 140),
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
          MobilePanel(
            title: roleProfile.checkoutPanelTitle,
            action: MobileTag(
              label: _cart.isEmpty ? 'WAITING' : 'LIVE CART',
              icon: _cart.isEmpty
                  ? Icons.hourglass_top_rounded
                  : Icons.shopping_bag_rounded,
              accent: _cart.isEmpty
                  ? const Color(0xFFA78BFA)
                  : const Color(0xFF22C55E),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                LayoutBuilder(
                  builder: (context, constraints) {
                    final stacked = constraints.maxWidth < 370;
                    final metrics = <Widget>[
                      _PosPulseCard(
                        label: 'Cart total',
                        value: formatCurrency(_cartTotal),
                        caption: _cart.isEmpty
                            ? 'Ready for the first bill'
                            : '${_cart.length} line${_cart.length == 1 ? '' : 's'} ready',
                        icon: Icons.currency_rupee_rounded,
                        accent: const Color(0xFF22C55E),
                      ),
                      _PosPulseCard(
                        label: 'Customer',
                        value: _selectedCustomer?.name ?? 'Walk-in',
                        caption: _selectedCustomer == null
                            ? 'Attach only when needed'
                            : (_selectedCustomer?.phone ??
                                  _selectedCustomer?.email ??
                                  'Ledger linked'),
                        icon: Icons.groups_rounded,
                        accent: const Color(0xFF38BDF8),
                      ),
                    ];
                    if (stacked) {
                      return Column(
                        children: metrics
                            .expand(
                              (widget) => <Widget>[
                                widget,
                                if (widget != metrics.last)
                                  const SizedBox(height: 10),
                              ],
                            )
                            .toList(growable: false),
                      );
                    }
                    return Row(
                      children: metrics
                          .expand(
                            (widget) => <Widget>[
                              Expanded(child: widget),
                              if (widget != metrics.last)
                                const SizedBox(width: 10),
                            ],
                          )
                          .toList(growable: false),
                    );
                  },
                ),
                const SizedBox(height: 14),
                if (_cart.isEmpty)
                  const MobileEmptyState(
                    icon: Icons.shopping_cart_outlined,
                    title: 'Cart is empty',
                    body:
                        'Search or scan a product below, then review the cart when you are ready to collect payment.',
                  )
                else
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      ..._cart
                          .take(2)
                          .map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _PosCartPreviewRow(item: item),
                            ),
                          ),
                      if (_cart.length > 2)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            '+ ${_cart.length - 2} more line${_cart.length - 2 == 1 ? '' : 's'} in cart',
                            style: Theme.of(context).textTheme.bodySmall
                                ?.copyWith(
                                  color: Colors.white.withValues(alpha: 0.6),
                                  fontWeight: FontWeight.w700,
                                ),
                          ),
                        ),
                    ],
                  ),
                const SizedBox(height: 4),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final actions = <Widget>[
                      FilledButton.icon(
                        onPressed: _cart.isEmpty
                            ? null
                            : () => _openCartSheet(
                                context,
                                session: session,
                                backendApiClient: backendApiClient,
                                salesRepository: salesRepository,
                                syncCoordinator: syncCoordinator,
                                shop: shop,
                                customerDomainState: customerDomainState,
                                activeShopId: session?.shopId,
                              ),
                        icon: const Icon(Icons.shopping_bag_rounded),
                        label: const Text('Review cart'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => _showLookupActions(
                          context,
                          inventoryRepository: inventoryRepository,
                          includeCost: session?.canViewCost ?? false,
                        ),
                        icon: const Icon(Icons.qr_code_scanner_rounded),
                        label: Text(compactActions ? 'Scan' : 'Scan / lookup'),
                      ),
                    ];
                    if (constraints.maxWidth < 370) {
                      return Column(
                        children: actions
                            .expand(
                              (widget) => <Widget>[
                                widget,
                                if (widget != actions.last)
                                  const SizedBox(height: 10),
                              ],
                            )
                            .toList(growable: false),
                      );
                    }
                    return Row(
                      children: actions
                          .expand(
                            (widget) => <Widget>[
                              Expanded(child: widget),
                              if (widget != actions.last)
                                const SizedBox(width: 10),
                            ],
                          )
                          .toList(growable: false),
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: roleProfile.catalogPanelTitle,
            action: MobileTag(
              label: _selectedCategory ?? 'All categories',
              icon: Icons.tune_rounded,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    setState(() {
                      _search = value;
                      _page = 1;
                    });
                  },
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.search_rounded),
                    hintText: 'Search name, SKU, or exact code',
                    suffixIcon: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        if (_search.isNotEmpty)
                          IconButton(
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _search = '';
                                _page = 1;
                              });
                            },
                            icon: const Icon(Icons.close_rounded),
                          ),
                        IconButton(
                          tooltip: 'Scan or exact lookup',
                          onPressed: () async {
                            await _showLookupActions(
                              context,
                              inventoryRepository: inventoryRepository,
                              includeCost: session?.canViewCost ?? false,
                            );
                          },
                          icon: const Icon(Icons.qr_code_scanner_rounded),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_search.isNotEmpty ||
                    _selectedCategory != null) ...<Widget>[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: <Widget>[
                      if (_search.isNotEmpty)
                        MobileTag(
                          label: 'Search: ${_search.trim()}',
                          icon: Icons.search_rounded,
                          accent: const Color(0xFF38BDF8),
                        ),
                      if (_selectedCategory != null)
                        MobileTag(
                          label: _selectedCategory!,
                          icon: Icons.inventory_2_rounded,
                          accent: const Color(0xFFA78BFA),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                ],
                SizedBox(
                  height: 46,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: <Widget>[
                      _PosCategoryChip(
                        label: 'All',
                        active: _selectedCategory == null,
                        onTap: () {
                          setState(() {
                            _selectedCategory = null;
                            _page = 1;
                          });
                        },
                      ),
                      ...categories.map(
                        (category) => _PosCategoryChip(
                          label: category.category,
                          active: _selectedCategory == category.category,
                          onTap: () {
                            setState(() {
                              _selectedCategory = category.category;
                              _page = 1;
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        '$totalCount result${totalCount == 1 ? '' : 's'}',
                        style: Theme.of(context).textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    Text(
                      'Page $_page / $totalPages',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.6),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (items.isEmpty)
                  MobileEmptyState(
                    icon: syncStatus == MobileSyncStatus.syncing
                        ? Icons.sync_rounded
                        : Icons.point_of_sale_outlined,
                    title: syncStatus == MobileSyncStatus.syncing
                        ? 'POS catalog is still syncing'
                        : 'No billable products found',
                    body: syncStatus == MobileSyncStatus.syncing
                        ? 'Wait a moment while inventory lands into the local mobile catalog.'
                        : 'Try a different search or category filter.',
                  )
                else
                  Column(
                    children: <Widget>[
                      ...items.map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _PosCatalogRow(
                            item: item,
                            onAdd: () => _addToCart(item),
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _page > 1
                                  ? () {
                                      setState(() {
                                        _page -= 1;
                                      });
                                    }
                                  : null,
                              child: const Text('Previous'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton.tonal(
                              onPressed: _page < totalPages
                                  ? () {
                                      setState(() {
                                        _page += 1;
                                      });
                                    }
                                  : null,
                              child: const Text('Next'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _showLookupActions(
    BuildContext context, {
    required InventoryRepository inventoryRepository,
    required bool includeCost,
  }) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: const Color(0xFF070B13),
      builder: (context) {
        final typedCode = _searchController.text.trim();
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                MobileSheetHeader(
                  title: 'Scanner actions',
                  subtitle:
                      'Use the camera for live scanning or run an exact lookup against the code already typed into search.',
                  icon: Icons.qr_code_scanner_rounded,
                  accent: const Color(0xFF38BDF8),
                  tags: <Widget>[
                    MobileTag(
                      label: typedCode.isEmpty
                          ? 'TYPE A CODE FIRST'
                          : 'TYPED CODE READY',
                      icon: typedCode.isEmpty
                          ? Icons.keyboard_alt_rounded
                          : Icons.verified_rounded,
                      accent: typedCode.isEmpty
                          ? const Color(0xFFA78BFA)
                          : const Color(0xFF22C55E),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                MobileSheetSection(
                  title: 'Choose action',
                  accent: const Color(0xFF38BDF8),
                  child: Column(
                    children: <Widget>[
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.qr_code_scanner_rounded),
                        title: const Text('Open live scanner'),
                        subtitle: const Text(
                          'Scan barcode, QR, or SKU with camera',
                        ),
                        onTap: () => Navigator.of(context).pop('scan'),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.search_rounded),
                        title: const Text('Lookup typed code'),
                        subtitle: Text(
                          typedCode.isEmpty
                              ? 'Type a SKU or barcode into search first'
                              : typedCode,
                        ),
                        enabled: typedCode.isNotEmpty,
                        onTap: typedCode.isEmpty
                            ? null
                            : () => Navigator.of(context).pop('typed'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );

    if (!context.mounted || choice == null) {
      return;
    }

    if (choice == 'typed') {
      await _runExactLookup(
        context,
        inventoryRepository: inventoryRepository,
        includeCost: includeCost,
        lookup: _searchController.text,
      );
      return;
    }

    final scannedCode = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF070B13),
      builder: (context) => const PosScannerSheet(),
    );
    if (!context.mounted || scannedCode == null) {
      return;
    }

    _searchController.text = scannedCode;
    setState(() {
      _search = scannedCode;
      _page = 1;
    });
    await _runExactLookup(
      context,
      inventoryRepository: inventoryRepository,
      includeCost: includeCost,
      lookup: scannedCode,
    );
  }

  Future<void> _runExactLookup(
    BuildContext context, {
    required InventoryRepository inventoryRepository,
    required bool includeCost,
    required String lookup,
  }) async {
    final found = await inventoryRepository.findByExactLookup(
      lookup,
      includeCost: includeCost,
    );
    if (found == null) {
      if (!context.mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'No exact SKU or code match was found for "${lookup.trim()}".',
          ),
        ),
      );
      return;
    }

    _addToCart(found);
    if (!context.mounted) {
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${found.name} added to cart from exact lookup.')),
    );
  }

  void _addToCart(InventoryCatalogItem item) {
    final index = _cart.indexWhere((entry) => entry.id == item.id);
    HapticFeedback.selectionClick();
    setState(() {
      if (index >= 0) {
        _cart[index] = _cart[index].copyWith(
          quantity: _cart[index].quantity + 1,
        );
      } else {
        _cart.insert(
          0,
          PosCartItem(
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            stock: item.stock,
            category: item.category,
            size: item.size,
            sku: item.sku,
            costPrice: item.costPrice,
          ),
        );
      }
    });
  }

  Future<void> _openCartSheet(
    BuildContext context, {
    required MobileSession? session,
    required BackendApiClient backendApiClient,
    required SalesRepository salesRepository,
    required MobileSyncCoordinator syncCoordinator,
    required ShopInfo shop,
    required DomainControlState customerDomainState,
    required String? activeShopId,
  }) async {
    if (!context.mounted) {
      return;
    }
    final collectedController = TextEditingController(
      text: _cartTotal.toStringAsFixed(2),
    );
    final splitPayments = <_CheckoutPaymentDraft>[
      _CheckoutPaymentDraft(
        mode: _paymentMode == 'SPLIT' ? 'CASH' : _paymentMode,
        initialAmount: _paymentMode == 'SPLIT' ? _cartTotal : null,
      ),
    ];
    if (_footerController.text.trim().isEmpty) {
      _footerController.text = shop.footer;
    }
    try {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF0A1220),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        builder: (context) {
          return StatefulBuilder(
            builder: (context, setSheetState) {
              final total = _cartTotal;
              final checkoutCollected = _paymentMode == 'SPLIT'
                  ? splitPayments.fold<double>(
                      0,
                      (sum, payment) => sum + payment.amount,
                    )
                  : _parseMoney(collectedController.text);
              final checkoutDue = total - checkoutCollected;
              final currentCustomerBalance = _selectedCustomer?.balance ?? 0;
              final projectedCustomerBalance =
                  currentCustomerBalance + (checkoutDue > 0 ? checkoutDue : 0);
              return SafeArea(
                child: Padding(
                  padding: EdgeInsets.only(
                    left: 20,
                    right: 20,
                    top: 20,
                    bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                  ),
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Expanded(
                              child: Text(
                                'Checkout cart',
                                style: Theme.of(context).textTheme.headlineSmall
                                    ?.copyWith(fontWeight: FontWeight.w900),
                              ),
                            ),
                            MobileTag(
                              label: '${_cart.length} lines',
                              icon: Icons.shopping_basket_rounded,
                              accent: const Color(0xFF22C55E),
                            ),
                          ],
                        ),
                        const SizedBox(height: 18),
                        ..._cart.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(22),
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
                                            item.name,
                                            style: Theme.of(context)
                                                .textTheme
                                                .titleMedium
                                                ?.copyWith(
                                                  fontWeight: FontWeight.w800,
                                                ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            '${formatCurrency(item.price)} | Stock ${item.stock}',
                                            style: Theme.of(context)
                                                .textTheme
                                                .bodySmall
                                                ?.copyWith(
                                                  color: Colors.white
                                                      .withValues(alpha: 0.58),
                                                  fontWeight: FontWeight.w600,
                                                ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Row(
                                      children: <Widget>[
                                        IconButton(
                                          onPressed: () {
                                            setState(() {
                                              final next = item.quantity - 1;
                                              if (next <= 0) {
                                                _cart.removeWhere(
                                                  (entry) =>
                                                      entry.id == item.id,
                                                );
                                              } else {
                                                final idx = _cart.indexWhere(
                                                  (entry) =>
                                                      entry.id == item.id,
                                                );
                                                _cart[idx] = _cart[idx]
                                                    .copyWith(quantity: next);
                                              }
                                            });
                                            setSheetState(() {});
                                          },
                                          icon: const Icon(
                                            Icons.remove_circle_outline_rounded,
                                          ),
                                        ),
                                        Text(
                                          '${item.quantity}',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium
                                              ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                              ),
                                        ),
                                        IconButton(
                                          onPressed: () {
                                            setState(() {
                                              final idx = _cart.indexWhere(
                                                (entry) => entry.id == item.id,
                                              );
                                              _cart[idx] = _cart[idx].copyWith(
                                                quantity:
                                                    _cart[idx].quantity + 1,
                                              );
                                            });
                                            setSheetState(() {});
                                          },
                                          icon: const Icon(
                                            Icons.add_circle_outline_rounded,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        if (customerDomainState.isPostgresPrimary) ...<Widget>[
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: const Color(0xFF0B1622),
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(
                                color: const Color(
                                  0xFF14B8A6,
                                ).withValues(alpha: 0.18),
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
                                          _selectedCustomer == null
                                              ? 'Attach known customer'
                                              : _selectedCustomer!.name,
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium
                                              ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                              ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          _selectedCustomer == null
                                              ? 'Use migrated customer records so the sale links directly to ledger history.'
                                              : (_selectedCustomer!.phone ??
                                                    _selectedCustomer!.email ??
                                                    'Known customer attached'),
                                          style: Theme.of(context)
                                              .textTheme
                                              .bodySmall
                                              ?.copyWith(
                                                color: Colors.white.withValues(
                                                  alpha: 0.62,
                                                ),
                                                fontWeight: FontWeight.w600,
                                              ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  FilledButton.tonal(
                                    onPressed: () async {
                                      final picked = await _showCustomerPicker(
                                        context,
                                        backendApiClient: backendApiClient,
                                        session: session,
                                        activeShopId: activeShopId,
                                      );
                                      if (picked == null) {
                                        return;
                                      }
                                      setState(() {
                                        _selectedCustomer = picked;
                                        _customerController.text = picked.name;
                                        _phoneController.text =
                                            picked.phone ?? '';
                                      });
                                      setSheetState(() {});
                                    },
                                    child: Text(
                                      _selectedCustomer == null
                                          ? 'Pick'
                                          : 'Change',
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (_selectedCustomer != null) ...<Widget>[
                            const SizedBox(height: 10),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton.icon(
                                onPressed: () {
                                  setState(() {
                                    _selectedCustomer = null;
                                    _customerController.clear();
                                    _phoneController.clear();
                                  });
                                  setSheetState(() {});
                                },
                                icon: const Icon(Icons.link_off_rounded),
                                label: const Text(
                                  'Use walk-in or manual customer',
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 12),
                        ],
                        TextField(
                          controller: _customerController,
                          onChanged: (value) {
                            if (_selectedCustomer != null &&
                                value.trim() != _selectedCustomer!.name) {
                              setState(() {
                                _selectedCustomer = null;
                              });
                              setSheetState(() {});
                            }
                          },
                          decoration: const InputDecoration(
                            labelText: 'Customer name (optional)',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _phoneController,
                          onChanged: (value) {
                            if (_selectedCustomer != null &&
                                value.trim() !=
                                    (_selectedCustomer!.phone ?? '').trim()) {
                              setState(() {
                                _selectedCustomer = null;
                              });
                              setSheetState(() {});
                            }
                          },
                          keyboardType: TextInputType.phone,
                          decoration: const InputDecoration(
                            labelText: 'Customer phone (optional)',
                          ),
                        ),
                        const SizedBox(height: 14),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: _paymentModes
                              .map(
                                (mode) => ChoiceChip(
                                  label: Text(mode),
                                  selected: _paymentMode == mode,
                                  onSelected: (_) {
                                    setState(() {
                                      _paymentMode = mode;
                                    });
                                    if (mode != 'SPLIT') {
                                      splitPayments
                                        ..forEach(
                                          (payment) => payment.dispose(),
                                        )
                                        ..clear()
                                        ..add(
                                          _CheckoutPaymentDraft(mode: mode),
                                        );
                                      collectedController.text = total
                                          .toStringAsFixed(2);
                                    } else {
                                      splitPayments
                                        ..forEach(
                                          (payment) => payment.dispose(),
                                        )
                                        ..clear()
                                        ..add(
                                          _CheckoutPaymentDraft(
                                            mode: 'CASH',
                                            initialAmount: total,
                                          ),
                                        );
                                    }
                                    setSheetState(() {});
                                  },
                                ),
                              )
                              .toList(growable: false),
                        ),
                        const SizedBox(height: 12),
                        if (_paymentMode == 'SPLIT')
                          _SplitPaymentPanel(
                            payments: splitPayments,
                            total: total,
                            onChanged: () => setSheetState(() {}),
                            onAdd: () {
                              splitPayments.add(
                                _CheckoutPaymentDraft(
                                  mode: 'CASH',
                                  initialAmount: checkoutDue > 0
                                      ? checkoutDue
                                      : total,
                                ),
                              );
                              setSheetState(() {});
                            },
                            onRemove: (payment) {
                              if (splitPayments.length == 1) {
                                return;
                              }
                              payment.dispose();
                              splitPayments.remove(payment);
                              setSheetState(() {});
                            },
                          )
                        else
                          TextField(
                            controller: collectedController,
                            keyboardType: const TextInputType.numberWithOptions(
                              signed: false,
                              decimal: true,
                            ),
                            onChanged: (_) => setSheetState(() {}),
                            decoration: InputDecoration(
                              labelText: _paymentMode == 'CREDIT'
                                  ? 'Collected now (must be positive)'
                                  : 'Collected now',
                              helperText:
                                  'Enter less than the total if part of this bill should remain due.',
                            ),
                          ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _footerController,
                          maxLines: 2,
                          decoration: const InputDecoration(
                            labelText: 'Receipt footer',
                          ),
                        ),
                        const SizedBox(height: 18),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: const Color(0xFF0D1A11),
                            borderRadius: BorderRadius.circular(22),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: <Widget>[
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: <Widget>[
                                      Text(
                                        'Sale total',
                                        style: Theme.of(context)
                                            .textTheme
                                            .titleMedium
                                            ?.copyWith(
                                              fontWeight: FontWeight.w800,
                                            ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Payment mode: $_paymentMode',
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
                                Text(
                                  formatCurrency(total),
                                  style: Theme.of(context)
                                      .textTheme
                                      .headlineSmall
                                      ?.copyWith(
                                        color: const Color(0xFF22C55E),
                                        fontWeight: FontWeight.w900,
                                      ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        DecoratedBox(
                          decoration: BoxDecoration(
                            color: const Color(0xFF0A1220),
                            borderRadius: BorderRadius.circular(22),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.05),
                            ),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              children: <Widget>[
                                _CheckoutSummaryRow(
                                  label: 'Collected now',
                                  value: formatCurrency(checkoutCollected),
                                  tone: const Color(0xFF38BDF8),
                                ),
                                const SizedBox(height: 10),
                                _CheckoutSummaryRow(
                                  label: 'Due after sale',
                                  value: formatCurrency(
                                    checkoutDue > 0 ? checkoutDue : 0,
                                  ),
                                  tone: checkoutDue > 0
                                      ? const Color(0xFFF59E0B)
                                      : const Color(0xFF22C55E),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (_selectedCustomer != null &&
                            customerDomainState.isPostgresPrimary) ...<Widget>[
                          const SizedBox(height: 12),
                          DecoratedBox(
                            decoration: BoxDecoration(
                              color: const Color(0xFF0A1220),
                              borderRadius: BorderRadius.circular(22),
                              border: Border.all(
                                color:
                                    (checkoutDue > 0
                                            ? const Color(0xFFF59E0B)
                                            : const Color(0xFF14B8A6))
                                        .withValues(alpha: 0.2),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Row(
                                    children: <Widget>[
                                      Expanded(
                                        child: Text(
                                          'Ledger projection',
                                          style: Theme.of(context)
                                              .textTheme
                                              .titleMedium
                                              ?.copyWith(
                                                fontWeight: FontWeight.w800,
                                              ),
                                        ),
                                      ),
                                      MobileTag(
                                        label: checkoutDue > 0
                                            ? 'Credit exposed'
                                            : 'Settles clean',
                                        icon: checkoutDue > 0
                                            ? Icons
                                                  .account_balance_wallet_rounded
                                            : Icons.verified_rounded,
                                        accent: checkoutDue > 0
                                            ? const Color(0xFFF59E0B)
                                            : const Color(0xFF22C55E),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 12),
                                  _CheckoutSummaryRow(
                                    label: 'Current customer balance',
                                    value: formatCurrency(
                                      currentCustomerBalance,
                                    ),
                                    tone: currentCustomerBalance > 0
                                        ? const Color(0xFFF59E0B)
                                        : const Color(0xFF38BDF8),
                                  ),
                                  const SizedBox(height: 10),
                                  _CheckoutSummaryRow(
                                    label: 'Projected after this sale',
                                    value: formatCurrency(
                                      projectedCustomerBalance,
                                    ),
                                    tone: projectedCustomerBalance > 0
                                        ? const Color(0xFFF59E0B)
                                        : const Color(0xFF22C55E),
                                  ),
                                  if (checkoutDue > 0) ...<Widget>[
                                    const SizedBox(height: 10),
                                    Text(
                                      'This sale leaves ${formatCurrency(checkoutDue)} due on ${_selectedCustomer!.name}, so the ledger will carry that balance after replay.',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: Colors.white.withValues(
                                              alpha: 0.62,
                                            ),
                                            fontWeight: FontWeight.w600,
                                          ),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _saving
                              ? null
                              : () async {
                                  if (activeShopId == null ||
                                      activeShopId.isEmpty) {
                                    if (!mounted) {
                                      return;
                                    }
                                    ScaffoldMessenger.of(
                                      this.context,
                                    ).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Mobile session is not ready yet. Please wait for the shop to load.',
                                        ),
                                      ),
                                    );
                                    return;
                                  }

                                  final shortages = _cart
                                      .where(
                                        (item) => item.quantity > item.stock,
                                      )
                                      .toList(growable: false);
                                  if (shortages.isNotEmpty) {
                                    final force = await _showForceSaleDialog(
                                      context,
                                      shortages,
                                    );
                                    if (!force) {
                                      return;
                                    }
                                  }

                                  final resolvedPayments =
                                      _resolveCheckoutPayments(
                                        paymentMode: _paymentMode,
                                        total: total,
                                        collectedText: collectedController.text,
                                        splitPayments: splitPayments,
                                      );
                                  if (resolvedPayments == null) {
                                    if (!mounted) {
                                      return;
                                    }
                                    ScaffoldMessenger.of(
                                      this.context,
                                    ).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Checkout payment details are incomplete. Fix the amounts before completing the sale.',
                                        ),
                                      ),
                                    );
                                    return;
                                  }

                                  final customerName = _customerController.text
                                      .trim();
                                  final customerPhone = _phoneController.text
                                      .trim();
                                  final amountDue =
                                      total - resolvedPayments.totalCollected;
                                  final existingCustomerBalance =
                                      _selectedCustomer?.balance ?? 0;
                                  if (amountDue > 0 &&
                                      _selectedCustomer == null &&
                                      customerName.isEmpty) {
                                    if (!mounted) {
                                      return;
                                    }
                                    ScaffoldMessenger.of(
                                      this.context,
                                    ).showSnackBar(
                                      const SnackBar(
                                        content: Text(
                                          'Outstanding balance needs a named customer before this sale can be saved.',
                                        ),
                                      ),
                                    );
                                    return;
                                  }

                                  if (_selectedCustomer != null &&
                                      shouldConfirmCreditExposure(
                                        currentBalance: existingCustomerBalance,
                                        additionalDue: amountDue,
                                      )) {
                                    if (!mounted || !context.mounted) {
                                      return;
                                    }
                                    final continueWithExposure =
                                        await _showCreditExposureDialog(
                                          context,
                                          customer: _selectedCustomer!,
                                          currentBalance:
                                              existingCustomerBalance,
                                          additionalDue: amountDue,
                                        );
                                    if (!mounted || !context.mounted) {
                                      return;
                                    }
                                    if (!continueWithExposure) {
                                      return;
                                    }
                                  }

                                  setState(() {
                                    _saving = true;
                                  });
                                  setSheetState(() {});
                                  try {
                                    final commit = await salesRepository
                                        .recordLocalSale(
                                          shopId: activeShopId,
                                          items: List<PosCartItem>.from(_cart),
                                          payments: resolvedPayments.payments,
                                          paymentMode: _paymentMode,
                                          customerId: _selectedCustomer?.id,
                                          customerName: customerName.isEmpty
                                              ? null
                                              : customerName,
                                          customerPhone: customerPhone.isEmpty
                                              ? null
                                              : customerPhone,
                                          footerNote: _footerController.text
                                              .trim(),
                                        );
                                    final syncResult = await syncCoordinator
                                        .submitSale(commit);
                                    if (!mounted || !context.mounted) {
                                      return;
                                    }
                                    HapticFeedback.lightImpact();
                                    Navigator.of(context).pop();
                                    ScaffoldMessenger.of(
                                      this.context,
                                    ).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          syncResult.acceptedByBackend
                                              ? 'Sale saved for ${formatCurrency(commit.total)} and synced to backend'
                                              : 'Sale saved for ${formatCurrency(commit.total)} and queued for backend sync',
                                        ),
                                      ),
                                    );
                                    setState(() {
                                      _saving = false;
                                      _cart.clear();
                                      _selectedCustomer = null;
                                      _customerController.clear();
                                      _phoneController.clear();
                                    });
                                  } catch (error) {
                                    if (!mounted) {
                                      return;
                                    }
                                    ScaffoldMessenger.of(
                                      this.context,
                                    ).showSnackBar(
                                      SnackBar(
                                        content: Text('Sale failed: $error'),
                                      ),
                                    );
                                    setState(() {
                                      _saving = false;
                                    });
                                    setSheetState(() {});
                                  }
                                },
                          style: FilledButton.styleFrom(
                            minimumSize: const Size.fromHeight(56),
                          ),
                          child: _saving
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                  ),
                                )
                              : const Text('Complete sale'),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      );
    } finally {
      collectedController.dispose();
      for (final payment in splitPayments) {
        payment.dispose();
      }
    }
  }

  Future<bool> _showCreditExposureDialog(
    BuildContext context, {
    required BackendCustomerSummary customer,
    required double currentBalance,
    required double additionalDue,
  }) async {
    final projectedBalance = currentBalance + additionalDue;
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        final compact = MediaQuery.sizeOf(dialogContext).width < 420;
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
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
              boxShadow: const <BoxShadow>[
                BoxShadow(
                  color: Color(0x55000000),
                  blurRadius: 28,
                  offset: Offset(0, 18),
                ),
              ],
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Padding(
                padding: EdgeInsets.all(compact ? 18 : 22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    MobileSheetHeader(
                      eyebrow: 'Credit warning',
                      title: 'Confirm credit exposure',
                      subtitle:
                          '${customer.name} already carries ${formatCurrency(currentBalance)} due. This sale adds ${formatCurrency(additionalDue)} more and moves the projected balance to ${formatCurrency(projectedBalance)}.',
                      icon: Icons.warning_amber_rounded,
                      accent: const Color(0xFFF59E0B),
                      tags: <Widget>[
                        MobileTag(
                          label:
                              'Projected ${formatCurrency(projectedBalance)}',
                          icon: Icons.account_balance_wallet_rounded,
                          accent: const Color(0xFFFB7185),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const MobileSheetSection(
                      title: 'Before you continue',
                      child: Text(
                        'Continue only if you want this customer ledger to hold the new due after backend replay.',
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () =>
                                Navigator.of(dialogContext).pop(false),
                            child: const Text('Review sale'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () =>
                                Navigator.of(dialogContext).pop(true),
                            child: const Text('Continue'),
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
    return result == true;
  }

  Future<BackendCustomerSummary?> _showCustomerPicker(
    BuildContext context, {
    required BackendApiClient backendApiClient,
    required MobileSession? session,
    required String? activeShopId,
  }) async {
    if (session == null || activeShopId == null || activeShopId.isEmpty) {
      return null;
    }

    final searchController = TextEditingController();
    String query = '';

    try {
      return await showModalBottomSheet<BackendCustomerSummary>(
        context: context,
        isScrollControlled: true,
        backgroundColor: const Color(0xFF070B13),
        builder: (context) {
          final compact = MediaQuery.sizeOf(context).width < 420;
          return SafeArea(
            child: StatefulBuilder(
              builder: (context, setModalState) {
                final future = backendApiClient.fetchCustomers(
                  user: session.user,
                  shopId: activeShopId,
                  query: query,
                );

                return Padding(
                  padding: EdgeInsets.only(
                    left: compact ? 16 : 18,
                    right: compact ? 16 : 18,
                    top: compact ? 16 : 18,
                    bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      MobileSheetHeader(
                        eyebrow: 'Customer attach',
                        title: 'Pick migrated customer',
                        subtitle:
                            'Search the migrated customer list and attach the right buyer before checkout.',
                        icon: Icons.groups_rounded,
                        accent: const Color(0xFF14B8A6),
                        tags: const <Widget>[
                          MobileTag(
                            label: 'Live customer mode',
                            icon: Icons.verified_rounded,
                            accent: Color(0xFF22C55E),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      MobileSheetSection(
                        title: 'Search buyers',
                        child: TextField(
                          controller: searchController,
                          onChanged: (value) {
                            setModalState(() {
                              query = value.trim();
                            });
                          },
                          decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.search_rounded),
                            hintText: 'Search customer name or phone',
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      FutureBuilder<List<BackendCustomerSummary>>(
                        future: future,
                        builder: (context, snapshot) {
                          if (snapshot.connectionState ==
                              ConnectionState.waiting) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 28),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }

                          if (snapshot.hasError) {
                            return MobileEmptyState(
                              icon: Icons.error_outline_rounded,
                              title: 'Customer lookup failed',
                              body: snapshot.error.toString(),
                            );
                          }

                          final customers =
                              snapshot.data ?? const <BackendCustomerSummary>[];
                          if (customers.isEmpty) {
                            return const MobileEmptyState(
                              icon: Icons.groups_outlined,
                              title: 'No customers matched',
                              body:
                                  'Try a broader search term or use manual customer details for this sale.',
                            );
                          }

                          return ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: 380),
                            child: ListView(
                              shrinkWrap: true,
                              children: customers
                                  .map(
                                    (customer) => Padding(
                                      padding: const EdgeInsets.only(
                                        bottom: 10,
                                      ),
                                      child: Material(
                                        color: Colors.transparent,
                                        child: InkWell(
                                          onTap: () => Navigator.of(
                                            context,
                                          ).pop(customer),
                                          borderRadius: BorderRadius.circular(
                                            20,
                                          ),
                                          child: Ink(
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF0A1220),
                                              borderRadius:
                                                  BorderRadius.circular(20),
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
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: <Widget>[
                                                        Text(
                                                          customer.name,
                                                          style: Theme.of(context)
                                                              .textTheme
                                                              .titleMedium
                                                              ?.copyWith(
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w800,
                                                              ),
                                                        ),
                                                        const SizedBox(
                                                          height: 4,
                                                        ),
                                                        Text(
                                                          customer.phone ??
                                                              customer.email ??
                                                              customer.status,
                                                          style: Theme.of(context)
                                                              .textTheme
                                                              .bodySmall
                                                              ?.copyWith(
                                                                color: Colors
                                                                    .white
                                                                    .withValues(
                                                                      alpha:
                                                                          0.58,
                                                                    ),
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600,
                                                              ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                  const SizedBox(width: 12),
                                                  Column(
                                                    crossAxisAlignment:
                                                        CrossAxisAlignment.end,
                                                    children: <Widget>[
                                                      Text(
                                                        formatCurrency(
                                                          customer.balance,
                                                        ),
                                                        style: Theme.of(context)
                                                            .textTheme
                                                            .labelLarge
                                                            ?.copyWith(
                                                              color:
                                                                  customer.balance >
                                                                      0
                                                                  ? const Color(
                                                                      0xFFFB7185,
                                                                    )
                                                                  : const Color(
                                                                      0xFF22C55E,
                                                                    ),
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w900,
                                                            ),
                                                      ),
                                                      const SizedBox(height: 4),
                                                      Text(
                                                        'Spent ${formatCurrency(customer.totalSpent)}',
                                                        style: Theme.of(context)
                                                            .textTheme
                                                            .bodySmall
                                                            ?.copyWith(
                                                              color: Colors
                                                                  .white
                                                                  .withValues(
                                                                    alpha: 0.58,
                                                                  ),
                                                              fontWeight:
                                                                  FontWeight
                                                                      .w600,
                                                            ),
                                                      ),
                                                    ],
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(growable: false),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                );
              },
            ),
          );
        },
      );
    } finally {
      searchController.dispose();
    }
  }

  Future<bool> _showForceSaleDialog(
    BuildContext context,
    List<PosCartItem> shortages,
  ) async {
    final result = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        final compact = MediaQuery.sizeOf(dialogContext).width < 420;
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
              border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
              boxShadow: const <BoxShadow>[
                BoxShadow(
                  color: Color(0x55000000),
                  blurRadius: 28,
                  offset: Offset(0, 18),
                ),
              ],
            ),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Padding(
                padding: EdgeInsets.all(compact ? 18 : 22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    MobileSheetHeader(
                      eyebrow: 'Stock warning',
                      title: 'Stock is short',
                      subtitle:
                          'This cart needs more quantity than current stock. Force sale no longer needs a PIN, but we still want a clear confirmation.',
                      icon: Icons.inventory_2_rounded,
                      accent: const Color(0xFFFB7185),
                      tags: <Widget>[
                        MobileTag(
                          label: '${shortages.length} short lines',
                          icon: Icons.priority_high_rounded,
                          accent: const Color(0xFFF59E0B),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    MobileSheetSection(
                      title: 'Items needing attention',
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: shortages
                            .map(
                              (item) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Text(
                                  '${item.name}: need ${item.quantity}, available ${item.stock}',
                                ),
                              ),
                            )
                            .toList(growable: false),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () =>
                                Navigator.of(dialogContext).pop(false),
                            child: const Text('Go back'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: FilledButton(
                            onPressed: () =>
                                Navigator.of(dialogContext).pop(true),
                            child: const Text('Force sale'),
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
    return result == true;
  }

  double _parseMoney(String raw) {
    final sanitized = raw.trim().replaceAll(',', '');
    return double.tryParse(sanitized) ?? 0;
  }

  _CheckoutPaymentResolution? _resolveCheckoutPayments({
    required String paymentMode,
    required double total,
    required String collectedText,
    required List<_CheckoutPaymentDraft> splitPayments,
  }) {
    final resolution = resolveCheckoutPayments(
      paymentMode: paymentMode,
      total: total,
      collectedAmount: _parseMoney(collectedText),
      splitPayments: splitPayments
          .map(
            (payment) => CheckoutPaymentEntry(
              mode: payment.mode,
              amount: payment.amount,
            ),
          )
          .toList(growable: false),
    );
    if (resolution == null) {
      return null;
    }
    return _CheckoutPaymentResolution(
      payments: resolution.payments,
      totalCollected: resolution.totalCollected,
    );
  }
}

class _PosRoleProfile {
  const _PosRoleProfile({
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
    required this.checkoutPanelTitle,
    required this.catalogPanelTitle,
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
  final String checkoutPanelTitle;
  final String catalogPanelTitle;

  factory _PosRoleProfile.fromSession({
    required MobileSession? session,
    required int cartCount,
    required double cartTotal,
    required int pending,
    required MobileSyncStatus syncStatus,
  }) {
    final syncing = syncStatus == MobileSyncStatus.syncing;
    final hasCart = cartCount > 0;
    final primaryLabel = pending > 0
        ? '$pending queued'
        : hasCart
        ? '$cartCount in cart'
        : 'Ready to bill';
    final primaryIcon = pending > 0
        ? Icons.cloud_upload_rounded
        : hasCart
        ? Icons.shopping_cart_checkout_rounded
        : Icons.flash_on_rounded;
    final primaryAccent = pending > 0
        ? const Color(0xFFF59E0B)
        : const Color(0xFF22C55E);
    final secondaryLabel = syncing ? 'Syncing' : 'Local fast path';
    final secondaryIcon = syncing ? Icons.sync_rounded : Icons.bolt_rounded;
    final secondaryAccent = syncing
        ? const Color(0xFF38BDF8)
        : const Color(0xFFA78BFA);

    if (session?.isCashierLike ?? false) {
      return _PosRoleProfile(
        leadTitle: hasCart
            ? 'Close ${formatCurrency(cartTotal)} fast'
            : 'Ready for the next bill',
        leadSubtitle: hasCart
            ? 'The cart is live. Review it when you are ready to collect payment, or keep adding products without losing pace.'
            : 'Search, scan, and add products with the fewest taps possible. Checkout stays one step away.',
        leadIcon: Icons.point_of_sale_rounded,
        leadAccent: const Color(0xFF60A5FA),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: primaryIcon,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: secondaryIcon,
        secondaryTagAccent: secondaryAccent,
        checkoutPanelTitle: 'Current sale',
        catalogPanelTitle: 'Sell products',
      );
    }

    if (session?.isManager ?? false) {
      return _PosRoleProfile(
        leadTitle: hasCart
            ? '${formatCurrency(cartTotal)} ready to close'
            : 'Checkout floor is ready',
        leadSubtitle: hasCart
            ? 'This cart is ready for payment. Keep the line moving while stock and customer context stay close.'
            : 'Use the same fast checkout surface while keeping customer and stock context within one screen.',
        leadIcon: Icons.payments_rounded,
        leadAccent: const Color(0xFF14B8A6),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: primaryIcon,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: secondaryIcon,
        secondaryTagAccent: secondaryAccent,
        checkoutPanelTitle: 'Checkout flow',
        catalogPanelTitle: 'Product lookup',
      );
    }

    return _PosRoleProfile(
      leadTitle: hasCart
          ? '${formatCurrency(cartTotal)} ready to close'
          : 'POS is ready',
      leadSubtitle: hasCart
          ? 'Billing is active. Revenue, customers, and stock movement stay inside one clean checkout flow.'
          : 'Use the checkout surface to bill quickly without dragging admin complexity into the sales counter.',
      leadIcon: Icons.point_of_sale_rounded,
      leadAccent: const Color(0xFF60A5FA),
      primaryTagLabel: primaryLabel,
      primaryTagIcon: primaryIcon,
      primaryTagAccent: primaryAccent,
      secondaryTagLabel: secondaryLabel,
      secondaryTagIcon: secondaryIcon,
      secondaryTagAccent: secondaryAccent,
      checkoutPanelTitle: 'Active checkout',
      catalogPanelTitle: 'Product lookup',
    );
  }
}

class _PosPulseCard extends StatelessWidget {
  const _PosPulseCard({
    required this.label,
    required this.value,
    required this.caption,
    required this.icon,
    required this.accent,
  });

  final String label;
  final String value;
  final String caption;
  final IconData icon;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: accent, size: 18),
            ),
            const SizedBox(height: 12),
            Text(
              label.toUpperCase(),
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.48),
                fontWeight: FontWeight.w900,
                letterSpacing: 1.1,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 4),
            Text(
              caption,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.58),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PosCartPreviewRow extends StatelessWidget {
  const _PosCartPreviewRow({required this.item});

  final PosCartItem item;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${item.quantity} x ${formatCurrency(item.price)}',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              formatCurrency(item.lineTotal),
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: const Color(0xFF22C55E),
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PosCatalogRow extends StatelessWidget {
  const _PosCatalogRow({required this.item, required this.onAdd});

  final InventoryCatalogItem item;
  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context) {
    final stockTone = item.stock <= 5
        ? const Color(0xFFFB7185)
        : const Color(0xFF22C55E);
    final secondary = [
      if ((item.sku ?? '').isNotEmpty) item.sku!,
      item.category,
      if ((item.size ?? '').isNotEmpty) item.size!,
      'Stock ${item.stock}',
    ].join(' | ');

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
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: stockTone.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(Icons.sell_rounded, color: stockTone, size: 20),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    item.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    secondary,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 14),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                Text(
                  formatCurrency(item.price),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: stockTone.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    child: Text(
                      item.stock <= 5 ? 'Low stock' : 'In stock',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: stockTone,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                FilledButton.tonalIcon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Add'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _PosCategoryChip extends StatelessWidget {
  const _PosCategoryChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final activeColor = const Color(0xFF38BDF8);
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: Material(
        color: active
            ? activeColor.withValues(alpha: 0.14)
            : const Color(0xFF111827),
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Text(
              label,
              style: TextStyle(
                color: active ? activeColor : Colors.white70,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

const List<String> _paymentModes = <String>[
  'CASH',
  'UPI',
  'BANK',
  'CARD',
  'CREDIT',
  'OTHER',
  'SPLIT',
];

const List<String> _splitPaymentModes = <String>[
  'CASH',
  'UPI',
  'BANK',
  'CARD',
  'CREDIT',
  'OTHER',
];

class _CheckoutPaymentDraft {
  _CheckoutPaymentDraft({required this.mode, double? initialAmount})
    : controller = TextEditingController(
        text: (initialAmount ?? 0).toStringAsFixed(2),
      );

  final TextEditingController controller;
  String mode;

  double get amount {
    final sanitized = controller.text.trim().replaceAll(',', '');
    return double.tryParse(sanitized) ?? 0;
  }

  void dispose() {
    controller.dispose();
  }
}

class _CheckoutPaymentResolution {
  const _CheckoutPaymentResolution({
    required this.payments,
    required this.totalCollected,
  });

  final List<PosPayment> payments;
  final double totalCollected;
}

class _SplitPaymentPanel extends StatelessWidget {
  const _SplitPaymentPanel({
    required this.payments,
    required this.total,
    required this.onChanged,
    required this.onAdd,
    required this.onRemove,
  });

  final List<_CheckoutPaymentDraft> payments;
  final double total;
  final VoidCallback onChanged;
  final VoidCallback onAdd;
  final void Function(_CheckoutPaymentDraft payment) onRemove;

  @override
  Widget build(BuildContext context) {
    final allocated = payments.fold<double>(
      0,
      (sum, payment) => sum + payment.amount,
    );
    final remaining = total - allocated;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xFF0A1220),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.05)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    'Split payment plan',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                TextButton.icon(
                  onPressed: onAdd,
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Add line'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            ...payments.map(
              (payment) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      flex: 4,
                      child: DropdownButtonFormField<String>(
                        initialValue: payment.mode,
                        items: _splitPaymentModes
                            .map(
                              (mode) => DropdownMenuItem<String>(
                                value: mode,
                                child: Text(mode),
                              ),
                            )
                            .toList(growable: false),
                        onChanged: (value) {
                          if (value == null) {
                            return;
                          }
                          payment.mode = value;
                          onChanged();
                        },
                        decoration: const InputDecoration(labelText: 'Method'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 4,
                      child: TextField(
                        controller: payment.controller,
                        keyboardType: const TextInputType.numberWithOptions(
                          signed: false,
                          decimal: true,
                        ),
                        onChanged: (_) => onChanged(),
                        decoration: const InputDecoration(labelText: 'Amount'),
                      ),
                    ),
                    const SizedBox(width: 6),
                    IconButton(
                      onPressed: payments.length > 1
                          ? () => onRemove(payment)
                          : null,
                      icon: const Icon(Icons.delete_outline_rounded),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Allocated ${formatCurrency(allocated)} | Remaining ${formatCurrency(remaining > 0 ? remaining : 0)}',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Colors.white.withValues(alpha: 0.62),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CheckoutSummaryRow extends StatelessWidget {
  const _CheckoutSummaryRow({
    required this.label,
    required this.value,
    required this.tone,
  });

  final String label;
  final String value;
  final Color tone;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.68),
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Text(
          value,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
            color: tone,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}
