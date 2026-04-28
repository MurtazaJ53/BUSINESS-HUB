import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
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
    final salesRepository = ref.watch(salesRepositoryProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final shopStream = ref.watch(shopRepositoryProvider).watchShopInfo();
    final categoriesStream = inventoryRepository.watchCategories();
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
                salesRepository: salesRepository,
                syncCoordinator: syncCoordinator,
                shopStream: shopStream,
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
            eyebrow: 'Native checkout',
            title: 'Faster billing, lighter opening.',
            subtitle:
                'This POS searches the local catalog first so the screen stays usable even while cloud sync is still catching up.',
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                MobileTag(
                  label: '${_cart.length} in cart',
                  icon: Icons.shopping_cart_checkout_rounded,
                  accent: const Color(0xFF22C55E),
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
          if (_cart.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: const Color(0xFF0D1A11),
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(
                    color: const Color(0xFF22C55E).withValues(alpha: 0.18),
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: Row(
                    children: <Widget>[
                      Container(
                        width: 46,
                        height: 46,
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
                              style: Theme.of(context).textTheme.titleMedium
                                  ?.copyWith(fontWeight: FontWeight.w800),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${_cart.length} lines staged for checkout',
                              style: Theme.of(context).textTheme.bodySmall
                                  ?.copyWith(
                                    color: Colors.white.withValues(alpha: 0.62),
                                    fontWeight: FontWeight.w600,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 14),
                      Text(
                        formatCurrency(_cartTotal),
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          color: const Color(0xFF22C55E),
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
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
                          tooltip: 'Exact lookup',
                          onPressed: () async {
                            final found = await inventoryRepository
                                .findByExactLookup(
                                  _searchController.text,
                                  includeCost: session?.canViewCost ?? false,
                                );
                            if (found == null) {
                              if (!context.mounted) {
                                return;
                              }
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'No exact SKU or code match was found.',
                                  ),
                                ),
                              );
                              return;
                            }
                            _addToCart(found);
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
    required SalesRepository salesRepository,
    required MobileSyncCoordinator syncCoordinator,
    required Stream<ShopInfo> shopStream,
  }) async {
    final shop = await shopStream.first;
    if (!context.mounted) {
      return;
    }
    if (_footerController.text.trim().isEmpty) {
      _footerController.text = shop.footer;
    }

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
                                                color: Colors.white.withValues(
                                                  alpha: 0.58,
                                                ),
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
                                                (entry) => entry.id == item.id,
                                              );
                                            } else {
                                              final idx = _cart.indexWhere(
                                                (entry) => entry.id == item.id,
                                              );
                                              _cart[idx] = _cart[idx].copyWith(
                                                quantity: next,
                                              );
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
                                              quantity: _cart[idx].quantity + 1,
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
                      TextField(
                        controller: _customerController,
                        decoration: const InputDecoration(
                          labelText: 'Customer name (optional)',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _phoneController,
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
                                  setSheetState(() {});
                                },
                              ),
                            )
                            .toList(growable: false),
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
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(
                                      'Collect now',
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
                                style: Theme.of(context).textTheme.headlineSmall
                                    ?.copyWith(
                                      color: const Color(0xFF22C55E),
                                      fontWeight: FontWeight.w900,
                                    ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),
                      FilledButton(
                        onPressed: _saving
                            ? null
                            : () async {
                                final shortages = _cart
                                    .where((item) => item.quantity > item.stock)
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

                                setState(() {
                                  _saving = true;
                                });
                                setSheetState(() {});
                                try {
                                  final commit = await salesRepository
                                      .recordLocalSale(
                                        items: List<PosCartItem>.from(_cart),
                                        payments: <PosPayment>[
                                          PosPayment(
                                            mode: _paymentMode,
                                            amount: total,
                                          ),
                                        ],
                                        paymentMode: _paymentMode,
                                        customerName:
                                            _customerController.text
                                                .trim()
                                                .isEmpty
                                            ? null
                                            : _customerController.text.trim(),
                                        customerPhone:
                                            _phoneController.text.trim().isEmpty
                                            ? null
                                            : _phoneController.text.trim(),
                                        footerNote: _footerController.text
                                            .trim(),
                                      );
                                  await syncCoordinator.submitSale(commit);
                                  if (!mounted || !context.mounted) {
                                    return;
                                  }
                                  Navigator.of(context).pop();
                                  ScaffoldMessenger.of(
                                    this.context,
                                  ).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Sale saved for ${formatCurrency(commit.total)}',
                                      ),
                                    ),
                                  );
                                  setState(() {
                                    _saving = false;
                                    _cart.clear();
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
  'CARD',
  'CREDIT',
  'OTHERS',
];
