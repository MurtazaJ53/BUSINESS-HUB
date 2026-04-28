import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/utils/formatters.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  final _searchController = TextEditingController();
  String _search = '';
  String? _selectedCategory;
  bool _lowStockOnly = false;
  int _page = 1;
  static const _pageSize = 50;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final inventoryRepository = ref.watch(inventoryRepositoryProvider);
    final metricsStream =
        inventoryRepository.watchDashboardOverview(includeCost: session?.canViewCost ?? false);
    final categoriesStream = inventoryRepository.watchCategories();
    final pageStream = inventoryRepository.watchCatalogPage(
      search: _search,
      category: _selectedCategory,
      page: _page,
      pageSize: _pageSize,
      includeCost: session?.canViewCost ?? false,
      lowStockOnly: _lowStockOnly,
    );
    final countStream = inventoryRepository.watchCatalogCount(
      search: _search,
      category: _selectedCategory,
      lowStockOnly: _lowStockOnly,
    );

    return Scaffold(
      appBar: AppBar(title: const Text('Inventory')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          StreamBuilder<DashboardOverview>(
            stream: metricsStream,
            builder: (context, snapshot) {
              final metrics = snapshot.data?.metrics ?? InventoryMetrics.empty();
              return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _MetricPill(label: 'Items', value: '${metrics.totalItems}'),
                  _MetricPill(label: 'Low stock', value: '${metrics.lowStock}'),
                  _MetricPill(
                    label: 'Value',
                    value: formatCurrency(metrics.inventoryValue),
                  ),
                ],
              );
            },
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
              hintText: 'Search by name, SKU, or size',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _search.isEmpty
                  ? null
                  : IconButton(
                      onPressed: () {
                        _searchController.clear();
                        setState(() {
                          _search = '';
                          _page = 1;
                        });
                      },
                      icon: const Icon(Icons.close),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              FilterChip(
                selected: _lowStockOnly,
                label: const Text('Low stock only'),
                onSelected: (selected) {
                  setState(() {
                    _lowStockOnly = selected;
                    _page = 1;
                  });
                },
              ),
            ],
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
                          label: Text(
                            '${category.category} (${category.productCount})',
                          ),
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
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$totalCount products in local mobile catalog',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: 10),
                  StreamBuilder<List<InventoryCatalogItem>>(
                    stream: pageStream,
                    builder: (context, snapshot) {
                      final items =
                          snapshot.data ?? const <InventoryCatalogItem>[];
                      if (items.isEmpty) {
                        return const _EmptyInventoryState();
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
                                    if (item.size != null &&
                                        item.size!.isNotEmpty)
                                      item.size!,
                                    if (item.sku != null && item.sku!.isNotEmpty)
                                      item.sku!,
                                  ].join(' • '),
                                ),
                                trailing: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      formatCurrency(item.price),
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleMedium
                                          ?.copyWith(
                                            fontWeight: FontWeight.w800,
                                          ),
                                    ),
                                    Text('Stock ${item.stock}'),
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
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text('$label: $value'),
      avatar: const Icon(Icons.bolt_rounded, size: 18),
    );
  }
}

class _EmptyInventoryState extends StatelessWidget {
  const _EmptyInventoryState();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          children: const [
            Icon(Icons.inventory_2_outlined, size: 48),
            SizedBox(height: 12),
            Text('No products matched this mobile query.'),
          ],
        ),
      ),
    );
  }
}
