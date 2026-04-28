import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/utils/formatters.dart';
import '../../shell/presentation/mobile_surface.dart';

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _search = '';
  String? _selectedCategory;
  bool _lowStockOnly = false;
  int _page = 1;

  static const int _pageSize = 40;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final inventoryRepository = ref.watch(inventoryRepositoryProvider);
    final syncStatus = ref.watch(syncStatusProvider);
    final metricsStream = inventoryRepository.watchDashboardOverview(
      includeCost: session?.canViewCost ?? false,
    );
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

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 120),
      children: <Widget>[
        StreamBuilder<DashboardOverview>(
          stream: metricsStream,
          builder: (context, snapshot) {
            final metrics = snapshot.data?.metrics ?? InventoryMetrics.empty();
            return Column(
              children: <Widget>[
                MobileHeroBanner(
                  eyebrow: 'Inventory operations',
                  title: 'Inventory built for quick scrolling.',
                  subtitle:
                      'The catalog opens from local SQLite first, then keeps filling from cloud sync in the background.',
                  trailing: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: <Widget>[
                      MobileTag(
                        label: '${metrics.totalItems} products',
                        icon: Icons.inventory_2_rounded,
                      ),
                      const SizedBox(height: 10),
                      MobileTag(
                        label: '${metrics.lowStock} critical',
                        icon: Icons.warning_amber_rounded,
                        accent: const Color(0xFFFB7185),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                GridView.count(
                  crossAxisCount: 3,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                  childAspectRatio: 0.96,
                  children: <Widget>[
                    MobileMetricCard(
                      label: 'Items',
                      value: '${metrics.totalItems}',
                      caption: 'Catalog size',
                      icon: Icons.apps_rounded,
                    ),
                    MobileMetricCard(
                      label: 'Low stock',
                      value: '${metrics.lowStock}',
                      caption: 'Watchlist',
                      icon: Icons.error_outline_rounded,
                      accent: const Color(0xFFFB7185),
                    ),
                    MobileMetricCard(
                      label: 'Value',
                      value: formatCurrency(metrics.inventoryValue),
                      caption: syncStatus == MobileSyncStatus.syncing
                          ? 'Syncing now'
                          : 'Local total',
                      icon: Icons.currency_rupee_rounded,
                      accent: const Color(0xFF22C55E),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: 'Catalog controls',
          action: MobileTag(
            label: _lowStockOnly ? 'Low stock filter on' : 'All catalog',
            icon: _lowStockOnly ? Icons.filter_alt_rounded : Icons.tune_rounded,
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
                  hintText: 'Search name, SKU, or size',
                  prefixIcon: const Icon(Icons.search_rounded),
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
                          icon: const Icon(Icons.close_rounded),
                        ),
                ),
              ),
              const SizedBox(height: 14),
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
                        _CategoryChip(
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
                          (category) => _CategoryChip(
                            label:
                                '${category.category} (${category.productCount})',
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
              title: 'Catalog stream',
              action: MobileTag(
                label: '$totalCount visible',
                icon: Icons.view_agenda_rounded,
                accent: const Color(0xFFA78BFA),
              ),
              child: StreamBuilder<List<InventoryCatalogItem>>(
                stream: pageStream,
                builder: (context, snapshot) {
                  final items = snapshot.data ?? const <InventoryCatalogItem>[];

                  if (items.isEmpty) {
                    return MobileEmptyState(
                      icon: syncStatus == MobileSyncStatus.syncing
                          ? Icons.sync_rounded
                          : Icons.inventory_2_outlined,
                      title: syncStatus == MobileSyncStatus.syncing
                          ? 'Inventory is syncing in'
                          : 'No products matched',
                      body: syncStatus == MobileSyncStatus.syncing
                          ? 'Give the workspace a moment while the first inventory batch lands locally.'
                          : 'Try a different search term or category filter.',
                    );
                  }

                  return Column(
                    children: <Widget>[
                      ...items.map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _InventoryRow(item: item),
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
                            padding: const EdgeInsets.symmetric(horizontal: 12),
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
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
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

class _InventoryRow extends StatelessWidget {
  const _InventoryRow({required this.item});

  final InventoryCatalogItem item;

  @override
  Widget build(BuildContext context) {
    final priceTone = item.stock <= 5
        ? const Color(0xFFFB7185)
        : const Color(0xFF38BDF8);
    final secondary = [
      item.category,
      if ((item.size ?? '').isNotEmpty) item.size!,
      if ((item.sku ?? '').isNotEmpty) item.sku!,
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
                color: priceTone.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(Icons.inventory_2_rounded, color: priceTone),
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
                    color: priceTone,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Stock ${item.stock}',
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: Colors.white.withValues(alpha: 0.72),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
