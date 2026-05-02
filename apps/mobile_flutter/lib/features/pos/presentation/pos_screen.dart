import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/backend/backend_api_client.dart';
import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
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
    final inventoryRepository = ref.watch(inventoryRepositoryProvider);
    final shopRepository = ref.watch(shopRepositoryProvider);
    final salesRepository = ref.watch(salesRepositoryProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final backendApiClient = ref.watch(backendApiClientProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final shopStream = shopRepository.watchShopInfo();
    final categoriesStream = inventoryRepository.watchCategories();
    final pendingOutboxStream = salesRepository.watchPendingOutboxCount();
    final customerDomainStateStream = shopRepository.watchDomainState(
      'customers',
    );
    final catalogStream = inventoryRepository.watchCatalogPage(
      search: _search,
      category: _selectedCategory,
      page: _page,
      pageSize: _pageSize,
      includeCost: session?.canViewCost ?? false,
    );
    final countStream = inventoryRepository.watchCatalogCount(
      search: _search,
      category: _selectedCategory,
    );

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
                shopStream: shopStream,
                customerDomainStateStream: customerDomainStateStream,
                activeShopId: session?.shopId,
              ),
              backgroundColor: const Color(0xFF2563EB),
              icon: const Icon(Icons.shopping_bag_rounded),
              label: Text(
                '${_cart.length} items | ${formatCurrency(_cartTotal)}',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 140),
        children: <Widget>[
          MobileHeroBanner(
            eyebrow: 'Sales hub',
            title: 'Premium checkout, native speed.',
            subtitle:
                'The cart opens from local SQLite first, then the commerce outbox pushes accepted sales into the new backend without blocking checkout speed.',
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                StreamBuilder<int>(
                  stream: pendingOutboxStream,
                  builder: (context, snapshot) {
                    final pending = snapshot.data ?? 0;
                    return MobileTag(
                      label: pending > 0
                          ? '$pending queued'
                          : '${_cart.length} in cart',
                      icon: pending > 0
                          ? Icons.cloud_upload_rounded
                          : Icons.shopping_cart_checkout_rounded,
                      accent: pending > 0
                          ? const Color(0xFFF59E0B)
                          : const Color(0xFF22C55E),
                    );
                  },
                ),
                const SizedBox(height: 10),
                MobileTag(
                  label: syncStatus == MobileSyncStatus.syncing
                      ? 'Syncing'
                      : 'Ready',
                  icon: syncStatus == MobileSyncStatus.syncing
                      ? Icons.sync_rounded
                      : Icons.flash_on_rounded,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Cart pulse',
            action: MobileTag(
              label: _cart.isEmpty ? 'AWAITING ITEMS' : 'CHECKOUT READY',
              icon: _cart.isEmpty
                  ? Icons.hourglass_top_rounded
                  : Icons.shopping_bag_rounded,
              accent: _cart.isEmpty
                  ? const Color(0xFFA78BFA)
                  : const Color(0xFF22C55E),
            ),
            child: _cart.isEmpty
                ? const MobileEmptyState(
                    icon: Icons.shopping_cart_outlined,
                    title: 'Your cart is clear',
                    body:
                        'Search the local catalog below and tap products to begin billing.',
                  )
                : Column(
                    children: <Widget>[
                      DecoratedBox(
                        decoration: BoxDecoration(
                          color: const Color(0xFF0D1A11),
                          borderRadius: BorderRadius.circular(26),
                          border: Border.all(
                            color: const Color(
                              0xFF22C55E,
                            ).withValues(alpha: 0.18),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(18),
                          child: Row(
                            children: <Widget>[
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: const Color(
                                    0xFF22C55E,
                                  ).withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: const Icon(
                                  Icons.payments_rounded,
                                  color: Color(0xFF22C55E),
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(
                                      'Current cart ready',
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                          ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      '${_cart.length} lines staged for checkout',
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
                              const SizedBox(width: 14),
                              Text(
                                formatCurrency(_cartTotal),
                                style: Theme.of(context).textTheme.titleLarge
                                    ?.copyWith(
                                      color: const Color(0xFF22C55E),
                                      fontWeight: FontWeight.w900,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      ..._cart
                          .take(3)
                          .map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0A1220),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.05),
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
                                              '${item.quantity} x ${formatCurrency(item.price)}',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodySmall
                                                  ?.copyWith(
                                                    color: Colors.white
                                                        .withValues(
                                                          alpha: 0.58,
                                                        ),
                                                    fontWeight: FontWeight.w600,
                                                  ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Text(
                                        formatCurrency(item.lineTotal),
                                        style: Theme.of(context)
                                            .textTheme
                                            .labelLarge
                                            ?.copyWith(
                                              color: const Color(0xFF22C55E),
                                              fontWeight: FontWeight.w900,
                                            ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                    ],
                  ),
          ),
          const SizedBox(height: 18),
          MobilePanel(
            title: 'Search and add',
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
                StreamBuilder<List<InventoryCategorySummary>>(
                  stream: categoriesStream,
                  builder: (context, snapshot) {
                    final categories =
                        snapshot.data ?? const <InventoryCategorySummary>[];
                    return SizedBox(
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
                    );
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          StreamBuilder<int>(
            stream: countStream,
            builder: (context, countSnapshot) {
              final totalCount = countSnapshot.data ?? 0;
              final totalPages = totalCount == 0
                  ? 1
                  : (totalCount / _pageSize).ceil();
              return MobilePanel(
                title: 'Ready-to-bill products',
                action: MobileTag(
                  label: '$totalCount results',
                  icon: Icons.inventory_rounded,
                  accent: const Color(0xFFA78BFA),
                ),
                child: StreamBuilder<List<InventoryCatalogItem>>(
                  stream: catalogStream,
                  builder: (context, snapshot) {
                    final items =
                        snapshot.data ?? const <InventoryCatalogItem>[];
                    if (items.isEmpty) {
                      return MobileEmptyState(
                        icon: syncStatus == MobileSyncStatus.syncing
                            ? Icons.sync_rounded
                            : Icons.point_of_sale_outlined,
                        title: syncStatus == MobileSyncStatus.syncing
                            ? 'POS catalog is still syncing'
                            : 'No billable products found',
                        body: syncStatus == MobileSyncStatus.syncing
                            ? 'Wait a moment while inventory lands into the local mobile catalog.'
                            : 'Try a different search or category filter.',
                      );
                    }

                    return Column(
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
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                              ),
                              child: Text(
                                'Page $_page / $totalPages',
                                style: Theme.of(context).textTheme.labelLarge,
                              ),
                            ),
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
                    );
                  },
                ),
              );
            },
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
                Text(
                  'Scanner actions',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'Use the camera for live scanning or run an exact lookup against the code already typed into search.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.68),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 18),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.qr_code_scanner_rounded),
                  title: const Text('Open live scanner'),
                  subtitle: const Text('Scan barcode, QR, or SKU with camera'),
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
    required Stream<ShopInfo> shopStream,
    required Stream<DomainControlState> customerDomainStateStream,
    required String? activeShopId,
  }) async {
    final shop = await shopStream.first;
    final customerDomainState = await customerDomainStateStream.first;
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
                    left: 18,
                    right: 18,
                    top: 18,
                    bottom: MediaQuery.of(context).viewInsets.bottom + 20,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        'Pick migrated customer',
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w900),
                      ),
                      const SizedBox(height: 12),
                      TextField(
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
      builder: (context) {
        return AlertDialog(
          title: const Text('Stock is short'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              const Text(
                'This cart needs more quantity than current stock. Force sale no longer needs a PIN, but we still want you to confirm it.',
              ),
              const SizedBox(height: 12),
              ...shortages.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '${item.name}: need ${item.quantity}, available ${item.stock}',
                  ),
                ),
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Go back'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Force sale'),
            ),
          ],
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
    if (paymentMode == 'SPLIT') {
      final payments = <PosPayment>[];
      var collected = 0.0;
      for (final payment in splitPayments) {
        final amount = payment.amount;
        if (amount <= 0) {
          return null;
        }
        payments.add(PosPayment(mode: payment.mode, amount: amount));
        collected += amount;
      }
      if (payments.isEmpty || collected > total + 0.009) {
        return null;
      }
      return _CheckoutPaymentResolution(
        payments: payments,
        totalCollected: collected,
      );
    }

    final collected = _parseMoney(collectedText);
    if (collected <= 0 || collected > total + 0.009) {
      return null;
    }
    return _CheckoutPaymentResolution(
      payments: <PosPayment>[PosPayment(mode: paymentMode, amount: collected)],
      totalCollected: collected,
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
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                color: stockTone.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(Icons.sell_rounded, color: stockTone),
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
                const SizedBox(height: 8),
                FilledButton.tonal(onPressed: onAdd, child: const Text('Add')),
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
