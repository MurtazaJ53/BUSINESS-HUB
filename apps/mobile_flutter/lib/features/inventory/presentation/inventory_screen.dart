import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
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

  void _resetFilters() {
    _searchController.clear();
    setState(() {
      _search = '';
      _selectedCategory = null;
      _lowStockOnly = false;
      _page = 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final syncStatus = ref.watch(syncStatusProvider);
    final filter = InventoryCatalogFilter(
      search: _search,
      category: _selectedCategory,
      page: _page,
      pageSize: _pageSize,
      includeCost: session?.canViewCost ?? false,
      lowStockOnly: _lowStockOnly,
    );
    final metrics =
        ref
            .watch(inventoryOverviewProvider(session?.canViewCost ?? false))
            .asData
            ?.value
            .metrics ??
        InventoryMetrics.empty();
    final categories =
        ref.watch(inventoryCategoriesProvider).asData?.value ??
        const <InventoryCategorySummary>[];
    final items =
        ref.watch(inventoryCatalogPageProvider(filter)).asData?.value ??
        const <InventoryCatalogItem>[];
    final totalCount =
        ref.watch(inventoryCatalogCountProvider(filter)).asData?.value ?? 0;
    final totalPages = totalCount == 0 ? 1 : (totalCount / _pageSize).ceil();
    final hasActiveFilters =
        _search.trim().isNotEmpty || _selectedCategory != null || _lowStockOnly;
    final roleProfile = _InventoryRoleProfile.fromSession(
      session: session,
      metrics: metrics,
      syncStatus: syncStatus,
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
                  label: 'Catalog',
                  value: '${metrics.totalItems}',
                  caption: 'Products available',
                  icon: Icons.apps_rounded,
                  accent: const Color(0xFF38BDF8),
                ),
                MobileMetricCard(
                  label: 'Low stock',
                  value: '${metrics.lowStock}',
                  caption: _lowStockOnly ? 'Filtered now' : 'Needs refill',
                  icon: Icons.error_outline_rounded,
                  accent: const Color(0xFFFB7185),
                ),
                MobileMetricCard(
                  label: 'Stock value',
                  value: formatCurrency(metrics.inventoryValue),
                  caption: syncStatus == MobileSyncStatus.syncing
                      ? 'Refreshing locally'
                      : 'Local inventory total',
                  icon: Icons.currency_rupee_rounded,
                  accent: const Color(0xFF22C55E),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 18),
        MobilePanel(
          title: roleProfile.panelTitle,
          action: MobileTag(
            label: _lowStockOnly ? 'LOW STOCK ONLY' : '$totalCount VISIBLE',
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
                label: const Text('Low stock first'),
                onSelected: (selected) {
                  setState(() {
                    _lowStockOnly = selected;
                    _page = 1;
                  });
                },
              ),
              const SizedBox(height: 16),
              SizedBox(
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
              ),
              if (_search.isNotEmpty || _selectedCategory != null) ...<Widget>[
                const SizedBox(height: 14),
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
                    if (_lowStockOnly)
                      const MobileTag(
                        label: 'Low stock only',
                        icon: Icons.error_outline_rounded,
                        accent: Color(0xFFFB7185),
                      ),
                  ],
                ),
              ],
              if (hasActiveFilters) ...<Widget>[
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
              const SizedBox(height: 18),
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      '$totalCount result${totalCount == 1 ? '' : 's'}',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
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
                      : Icons.inventory_2_outlined,
                  title: syncStatus == MobileSyncStatus.syncing
                      ? 'Inventory is syncing in'
                      : 'No products matched',
                  body: syncStatus == MobileSyncStatus.syncing
                      ? 'Give the workspace a moment while the first inventory batch lands locally.'
                      : 'Try a different search term or category filter.',
                )
              else
                Column(
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
    );
  }
}

class _InventoryRoleProfile {
  const _InventoryRoleProfile({
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
    required this.panelTitle,
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
  final String panelTitle;

  factory _InventoryRoleProfile.fromSession({
    required dynamic session,
    required InventoryMetrics metrics,
    required MobileSyncStatus syncStatus,
  }) {
    final syncing = syncStatus == MobileSyncStatus.syncing;
    final primaryLabel = metrics.lowStock > 0
        ? '${metrics.lowStock} low stock'
        : '${metrics.totalItems} products';
    final primaryAccent = metrics.lowStock > 0
        ? const Color(0xFFFB7185)
        : const Color(0xFF38BDF8);
    final secondaryLabel = syncing ? 'Refreshing' : 'Stock view ready';
    final secondaryAccent = syncing
        ? const Color(0xFF38BDF8)
        : const Color(0xFF22C55E);

    if (session?.isCashierLike ?? false) {
      return _InventoryRoleProfile(
        leadTitle: metrics.lowStock > 0
            ? '${metrics.lowStock} items need refill'
            : 'Find stock fast',
        leadSubtitle:
            'Search products, check available stock, and spot refill risk without leaving the selling flow.',
        leadIcon: Icons.inventory_2_rounded,
        leadAccent: const Color(0xFF1D4ED8),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: Icons.inventory_2_rounded,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: syncing ? Icons.sync_rounded : Icons.verified_rounded,
        secondaryTagAccent: secondaryAccent,
        panelTitle: 'Find stock',
      );
    }

    if (session?.isManager ?? false) {
      return _InventoryRoleProfile(
        leadTitle: metrics.lowStock > 0
            ? '${metrics.lowStock} products need attention'
            : 'Inventory is under control',
        leadSubtitle:
            'Use one fast surface to search the catalog, scan refill risk, and monitor local stock value.',
        leadIcon: Icons.inventory_2_rounded,
        leadAccent: const Color(0xFF1D4ED8),
        primaryTagLabel: primaryLabel,
        primaryTagIcon: Icons.error_outline_rounded,
        primaryTagAccent: primaryAccent,
        secondaryTagLabel: secondaryLabel,
        secondaryTagIcon: syncing
            ? Icons.sync_rounded
            : Icons.assessment_rounded,
        secondaryTagAccent: secondaryAccent,
        panelTitle: 'Stock search',
      );
    }

    return _InventoryRoleProfile(
      leadTitle: metrics.lowStock > 0
          ? '${metrics.lowStock} products need refill'
          : 'Inventory pulse ready',
      leadSubtitle:
          'Track stock health, product count, and local inventory value from one cleaner catalog view.',
      leadIcon: Icons.inventory_2_rounded,
      leadAccent: const Color(0xFF1D4ED8),
      primaryTagLabel: primaryLabel,
      primaryTagIcon: Icons.inventory_2_rounded,
      primaryTagAccent: primaryAccent,
      secondaryTagLabel: secondaryLabel,
      secondaryTagIcon: syncing
          ? Icons.sync_rounded
          : Icons.currency_rupee_rounded,
      secondaryTagAccent: secondaryAccent,
      panelTitle: 'Catalog search',
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
              width: 48,
              height: 48,
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
