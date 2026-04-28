import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final _searchController = TextEditingController();
  final _customerController = TextEditingController();
  final _phoneController = TextEditingController();
  final _footerController = TextEditingController();

  final List<PosCartItem> _cart = [];
  String _search = '';
  String? _selectedCategory;
  String _paymentMode = 'CASH';
  bool _saving = false;
  int _page = 1;
  static const _pageSize = 40;

  @override
  void dispose() {
    _searchController.dispose();
    _customerController.dispose();
    _phoneController.dispose();
    _footerController.dispose();
    super.dispose();
  }

  double get _cartTotal => _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final inventoryRepository = ref.watch(inventoryRepositoryProvider);
    final salesRepository = ref.watch(salesRepositoryProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
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
      appBar: AppBar(
        title: const Text('POS'),
        actions: [
          IconButton(
            onPressed: _cart.isEmpty
                ? null
                : () => _openCartSheet(
                      context,
                      salesRepository: salesRepository,
                      syncCoordinator: syncCoordinator,
                      shopStream: shopStream,
                    ),
            icon: Badge(
              label: Text('${_cart.length}'),
              child: const Icon(Icons.shopping_cart_checkout_rounded),
            ),
          ),
        ],
      ),
      floatingActionButton: _cart.isEmpty
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _openCartSheet(
                context,
                salesRepository: salesRepository,
                syncCoordinator: syncCoordinator,
                shopStream: shopStream,
              ),
              icon: const Icon(Icons.shopping_bag_rounded),
              label: Text('${_cart.length} • ${formatCurrency(_cartTotal)}'),
            ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Fast native checkout',
            style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            'Search and add from local SQLite first. This avoids rendering the full catalog on every open.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _searchController,
            onChanged: (value) {
              setState(() {
                _search = value;
                _page = 1;
              });
            },
            decoration: InputDecoration(
              prefixIcon: const Icon(Icons.search),
              hintText: 'Search by name, SKU, or exact code',
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_search.isNotEmpty)
                    IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _search = '';
                          _page = 1;
                        });
                      },
                      icon: const Icon(Icons.close),
                    ),
                  IconButton(
                    tooltip: 'Exact lookup',
                    onPressed: () async {
                      final found = await inventoryRepository.findByExactLookup(
                        _searchController.text,
                        includeCost: session?.canViewCost ?? false,
                      );
                      if (found == null) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('No SKU or exact code match found.')),
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
          const SizedBox(height: 12),
          StreamBuilder<List<InventoryCategorySummary>>(
            stream: categoriesStream,
            builder: (context, snapshot) {
              final categories =
                  snapshot.data ?? const <InventoryCategorySummary>[];
              return SizedBox(
                height: 48,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: const Text('All'),
                        selected: _selectedCategory == null,
                        onSelected: (_) {
                          setState(() {
                            _selectedCategory = null;
                            _page = 1;
                          });
                        },
                      ),
                    ),
                    ...categories.map(
                      (category) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(category.category),
                          selected: _selectedCategory == category.category,
                          onSelected: (_) {
                            setState(() {
                              _selectedCategory = category.category;
                              _page = 1;
                            });
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          StreamBuilder<int>(
            stream: countStream,
            builder: (context, countSnapshot) {
              final totalCount = countSnapshot.data ?? 0;
              final totalPages =
                  totalCount == 0 ? 1 : (totalCount / _pageSize).ceil();
              return StreamBuilder<List<InventoryCatalogItem>>(
                stream: catalogStream,
                builder: (context, snapshot) {
                  final items =
                      snapshot.data ?? const <InventoryCatalogItem>[];
                  if (items.isEmpty) {
                    return const _InfoTile(
                      title: 'No products ready',
                      body:
                          'Once your inventory sync lands locally, products will appear here for fast mobile checkout.',
                    );
                  }
                  return Column(
                    children: [
                      ...items.map(
                        (item) => Card(
                          child: ListTile(
                            title: Text(item.name),
                            subtitle: Text(
                              [
                                item.category,
                                if (item.size != null && item.size!.isNotEmpty)
                                  item.size!,
                                'Stock ${item.stock}',
                              ].join(' • '),
                            ),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  formatCurrency(item.price),
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(height: 4),
                                FilledButton.tonal(
                                  onPressed: () => _addToCart(item),
                                  child: const Text('Add'),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
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
                            padding:
                                const EdgeInsets.symmetric(horizontal: 12),
                            child: Text('Page $_page / $totalPages'),
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
        _cart[index] = _cart[index].copyWith(quantity: _cart[index].quantity + 1);
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
    if (!context.mounted) return;
    if (_footerController.text.trim().isEmpty) {
      _footerController.text = shop.footer;
    }

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
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
                    children: [
                      Text(
                        'Current order',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 16),
                      ..._cart.map(
                        (item) => Card(
                          child: ListTile(
                            title: Text(item.name),
                            subtitle: Text(
                              '${formatCurrency(item.price)} • Stock ${item.stock}',
                            ),
                            trailing: SizedBox(
                              width: 140,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  IconButton(
                                    onPressed: () {
                                      setState(() {
                                        final next = item.quantity - 1;
                                        if (next <= 0) {
                                          _cart.removeWhere((entry) => entry.id == item.id);
                                        } else {
                                          final idx = _cart.indexWhere((entry) => entry.id == item.id);
                                          _cart[idx] = _cart[idx].copyWith(quantity: next);
                                        }
                                      });
                                      setSheetState(() {});
                                    },
                                    icon: const Icon(Icons.remove_circle_outline),
                                  ),
                                  Text('${item.quantity}'),
                                  IconButton(
                                    onPressed: () {
                                      setState(() {
                                        final idx = _cart.indexWhere((entry) => entry.id == item.id);
                                        _cart[idx] =
                                            _cart[idx].copyWith(quantity: _cart[idx].quantity + 1);
                                      });
                                      setSheetState(() {});
                                    },
                                    icon: const Icon(Icons.add_circle_outline),
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
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        children: const ['CASH', 'UPI', 'CARD', 'CREDIT', 'OTHERS']
                            .map(
                              (mode) => mode,
                            )
                            .toList(growable: false)
                            .map(
                              (mode) => ChoiceChip(
                                label: Text(mode),
                                selected: false,
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        children: ['CASH', 'UPI', 'CARD', 'CREDIT', 'OTHERS']
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
                      const SizedBox(height: 16),
                      Text(
                        'Total: ${formatCurrency(total)}',
                        style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                              fontWeight: FontWeight.w800,
                            ),
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _saving
                            ? null
                            : () async {
                                final shortages = _cart
                                    .where((item) => item.quantity > item.stock)
                                    .toList(growable: false);
                                if (shortages.isNotEmpty) {
                                  final force =
                                      await _showForceSaleDialog(context, shortages);
                                  if (!force) {
                                    return;
                                  }
                                }

                                setState(() {
                                  _saving = true;
                                });
                                setSheetState(() {});
                                try {
                                  final commit = await salesRepository.recordLocalSale(
                                    items: List<PosCartItem>.from(_cart),
                                    payments: [
                                      PosPayment(mode: _paymentMode, amount: total),
                                    ],
                                    paymentMode: _paymentMode,
                                    customerName: _customerController.text.trim().isEmpty
                                        ? null
                                        : _customerController.text.trim(),
                                    customerPhone: _phoneController.text.trim().isEmpty
                                        ? null
                                        : _phoneController.text.trim(),
                                    footerNote: _footerController.text.trim(),
                                  );
                                  await syncCoordinator.submitSale(commit);
                                  if (!mounted || !context.mounted) return;
                                  Navigator.of(context).pop();
                                  ScaffoldMessenger.of(this.context).showSnackBar(
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
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(this.context).showSnackBar(
                                    SnackBar(content: Text('Sale failed: $error')),
                                  );
                                  setState(() {
                                    _saving = false;
                                  });
                                  setSheetState(() {});
                                }
                              },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          child: _saving
                              ? const CircularProgressIndicator()
                              : const Text('Complete sale'),
                        ),
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
          title: const Text('Not enough stock'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'This sale needs more quantity than current stock. Force sale now works without a PIN.',
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
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text('Go back'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Force sale anyway'),
            ),
          ],
        );
      },
    );
    return result == true;
  }
}

class _InfoTile extends StatelessWidget {
  const _InfoTile({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(body),
          ],
        ),
      ),
    );
  }
}
