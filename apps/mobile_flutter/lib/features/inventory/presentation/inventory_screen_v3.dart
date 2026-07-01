import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/premium_components.dart';

/// Redesigned Inventory Screen v3.0
/// Simple, Clean, Premium, Professional
class InventoryScreenV3 extends ConsumerStatefulWidget {
  const InventoryScreenV3({super.key});

  @override
  ConsumerState<InventoryScreenV3> createState() => _InventoryScreenV3State();
}

class _InventoryScreenV3State extends ConsumerState<InventoryScreenV3> {
  final TextEditingController _searchController = TextEditingController();

  String _search = '';
  String? _selectedCategory;
  bool _showLowStockOnly = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final categories =
        ref.watch(inventoryCategoriesProvider).asData?.value ??
        const <InventoryCategorySummary>[];
    final catalogFilter = InventoryCatalogFilter(
      search: _search,
      category: _selectedCategory,
      pageSize: 250,
      lowStockOnly: _showLowStockOnly,
    );
    final items =
        ref.watch(inventoryCatalogPageProvider(catalogFilter)).asData?.value ??
        const <InventoryCatalogItem>[];

    final filteredItems = items.where((item) {
      if (_search.isNotEmpty &&
          !item.name.toLowerCase().contains(_search.toLowerCase())) {
        return false;
      }
      if (_selectedCategory != null && item.category != _selectedCategory) {
        return false;
      }
      if (_showLowStockOnly && item.stock > 5) {
        return false;
      }
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.of(context).background,
      body: SafeArea(
        child: Column(
          children: [
            // Header with search
            _buildHeader(context),

            // Filters
            _buildFilters(categories),

            // Items list
            Expanded(
              child: filteredItems.isEmpty
                  ? EmptyStateWidget(
                      icon: Icons.inventory_2_rounded,
                      title: 'No items found',
                      message: _search.isEmpty
                          ? 'Start adding products to your inventory'
                          : 'Try a different search term or filter',
                    )
                  : _buildItemsList(filteredItems),
            ),
          ],
        ),
      ),
      // Add item FAB
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showAddItemSheet(context),
        backgroundColor: AppPalette.primary,
        icon: const Icon(Icons.add_rounded, size: 24),
        label: Text(
          'Add Item',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.2,
          ),
        ),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              IconButton(
                icon: const Icon(Icons.arrow_back_rounded),
                onPressed: () => context.pop(),
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 12),
              Text(
                'Inventory',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          PremiumSearchBar(
            controller: _searchController,
            hintText: 'Search inventory...',
            onChanged: (value) {
              setState(() {
                _search = value;
              });
            },
            onClear: () {
              setState(() {
                _search = '';
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFilters(List<InventoryCategorySummary> categories) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: Column(
        children: [
          // Category filters
          if (categories.isNotEmpty) ...[
            SizedBox(
              height: 40,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: categories.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  if (index == 0) {
                    return _buildCategoryChip(
                      label: 'All',
                      isSelected: _selectedCategory == null,
                      onTap: () {
                        setState(() {
                          _selectedCategory = null;
                        });
                      },
                    );
                  }

                  final category = categories[index - 1];
                  return _buildCategoryChip(
                    label: category.category,
                    isSelected: _selectedCategory == category.category,
                    onTap: () {
                      setState(() {
                        _selectedCategory = category.category;
                      });
                    },
                  );
                },
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Low stock toggle
          Row(
            children: [
              Expanded(
                child: Text(
                  'Show low stock only',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.of(context).textPrimary,
                  ),
                ),
              ),
              Switch(
                value: _showLowStockOnly,
                onChanged: (value) {
                  setState(() {
                    _showLowStockOnly = value;
                  });
                },
                activeColor: AppPalette.primary,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: isSelected ? AppPalette.primary : AppColors.of(context).surfaceStrong,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: isSelected ? Colors.white : AppColors.of(context).textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildItemsList(List<InventoryCatalogItem> items) {
    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 100),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return EnhancedListItem(
          title: item.name,
          subtitle:
              '${item.category} • Stock: ${item.stock} • ${formatCurrency(item.price)}',
          leadingIcon: Icons.inventory_2_rounded,
          leadingColor: item.stock <= 5
              ? AppPalette.error
              : AppPalette.inventory,
          trailing: StatusBadge(
            label: item.stock <= 5 ? 'Low' : 'OK',
            color: item.stock <= 5 ? AppPalette.error : AppPalette.success,
          ),
          onTap: () => _showItemDetails(context, item),
        );
      },
    );
  }

  void _showItemDetails(BuildContext context, InventoryCatalogItem item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: BoxDecoration(
          color: AppColors.of(context).background,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.of(context).border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Item details
            Text(
              item.name,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.of(context).textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              item.category,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.of(context).textSecondary,
              ),
            ),
            const SizedBox(height: 24),

            // Metrics
            Row(
              children: [
                Expanded(
                  child: _buildMetricBox(
                    label: 'Price',
                    value: formatCurrency(item.price),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildMetricBox(
                    label: 'Stock',
                    value: '${item.stock}',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Actions
            PrimaryActionButton(
              label: 'Edit Item',
              icon: Icons.edit_rounded,
              onPressed: () {
                Navigator.pop(context);
                // TODO: Navigate to edit screen
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricBox({required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.of(context).borderSoft, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 1.2,
              color: AppColors.of(context).textTertiary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: AppColors.of(context).textPrimary,
            ),
          ),
        ],
      ),
    );
  }

  void _showAddItemSheet(BuildContext context) {
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController();
    final priceController = TextEditingController();
    final stockController = TextEditingController(text: '0');
    final categoryController = TextEditingController(text: 'General');
    final skuController = TextEditingController();
    final hsnController = TextEditingController();
    final gstController = TextEditingController(text: '0');
    var priceIncludesTax = true;
    var isSaving = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> saveItem() async {
              if (formKey.currentState?.validate() != true || isSaving) {
                return;
              }

              setSheetState(() => isSaving = true);
              try {
                final price = double.parse(priceController.text.trim());
                final openingStock = int.parse(stockController.text.trim());
                final gstRate =
                    double.tryParse(gstController.text.trim()) ?? 0;

                await ref
                    .read(mobileSyncCoordinatorProvider)
                    .createInventoryItem(
                      name: nameController.text.trim(),
                      sellPrice: price,
                      openingStock: openingStock,
                      category: categoryController.text.trim(),
                      sku: skuController.text.trim(),
                      hsnCode: hsnController.text.trim(),
                      gstRate: gstRate,
                      priceIncludesTax: priceIncludesTax,
                    );

                if (!sheetContext.mounted) {
                  return;
                }
                Navigator.pop(sheetContext);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('${nameController.text.trim()} added.'),
                  ),
                );
              } catch (error) {
                if (!sheetContext.mounted) {
                  return;
                }
                setSheetState(() => isSaving = false);
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  SnackBar(content: Text('Add item failed: $error')),
                );
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.of(sheetContext).background,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(24),
                  ),
                ),
                padding: const EdgeInsets.all(24),
                child: SafeArea(
                  top: false,
                  child: SingleChildScrollView(
                    child: Form(
                      key: formKey,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: AppColors.of(sheetContext).border,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            'Add New Item',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: AppColors.of(sheetContext).textPrimary,
                            ),
                          ),
                          const SizedBox(height: 24),
                          TextFormField(
                            controller: nameController,
                            decoration: const InputDecoration(
                              labelText: 'Item name',
                            ),
                            validator: (value) =>
                                value == null || value.trim().isEmpty
                                ? 'Item name is required'
                                : null,
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: priceController,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: const InputDecoration(
                              labelText: 'Selling price',
                            ),
                            validator: (value) {
                              final parsed = double.tryParse(
                                value?.trim() ?? '',
                              );
                              if (parsed == null || parsed <= 0) {
                                return 'Enter a valid selling price';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: stockController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              labelText: 'Opening stock',
                            ),
                            validator: (value) {
                              final parsed = int.tryParse(
                                value?.trim() ?? '',
                              );
                              if (parsed == null || parsed < 0) {
                                return 'Enter stock as 0 or more';
                              }
                              return null;
                            },
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: categoryController,
                            decoration: const InputDecoration(
                              labelText: 'Category',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: skuController,
                            decoration: const InputDecoration(
                              labelText: 'SKU optional',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: hsnController,
                            decoration: const InputDecoration(
                              labelText: 'HSN/SAC optional',
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: gstController,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: const InputDecoration(
                              labelText: 'GST rate %',
                            ),
                          ),
                          const SizedBox(height: 8),
                          SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            value: priceIncludesTax,
                            activeColor: AppPalette.primary,
                            title: const Text('Price includes GST'),
                            onChanged: (value) {
                              setSheetState(() => priceIncludesTax = value);
                            },
                          ),
                          const SizedBox(height: 20),
                          PrimaryActionButton(
                            label: isSaving ? 'Saving...' : 'Create Item',
                            icon: Icons.add_rounded,
                            onPressed: isSaving ? null : saveItem,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        );
      },
    ).whenComplete(() {
      nameController.dispose();
      priceController.dispose();
      stockController.dispose();
      categoryController.dispose();
      skuController.dispose();
      hsnController.dispose();
      gstController.dispose();
    });
  }
}
