import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/images/product_image_store.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/premium_components.dart';
import '../../pos/presentation/pos_scanner_sheet.dart';

/// Redesigned Inventory Screen v3.0
/// Simple, Clean, Premium, Professional
class InventoryScreenV3 extends ConsumerStatefulWidget {
  const InventoryScreenV3({super.key});

  @override
  ConsumerState<InventoryScreenV3> createState() => _InventoryScreenV3State();
}

class _InventoryScreenV3State extends ConsumerState<InventoryScreenV3> {
  /// Units of measurement offered in the item form.
  static const List<String> _unitOptions = <String>[
    'pcs',
    'kg',
    'g',
    'litre',
    'ml',
    'box',
    'pack',
    'dozen',
    'metre',
    'feet',
  ];

  final TextEditingController _searchController = TextEditingController();

  String _search = '';
  String? _selectedCategory;
  bool _showLowStockOnly = false;
  Timer? _searchDebounce;

  void _onSearchChanged(String value) {
    _searchDebounce?.cancel();
    _searchDebounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _search = value);
    });
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
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
              const Spacer(),
              IconButton(
                onPressed: () => context.push('/categories'),
                icon: const Icon(Icons.category_rounded),
                tooltip: 'Categories',
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
              const SizedBox(width: 8),
              TextButton.icon(
                onPressed: () => _showBulkAddSheet(context),
                icon: const Icon(Icons.playlist_add_rounded, size: 18),
                label: const Text('Bulk'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          PremiumSearchBar(
            controller: _searchController,
            hintText: 'Search inventory...',
            onChanged: _onSearchChanged,
            onClear: () {
              _searchDebounce?.cancel();
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

  /// A 56x56 product photo for list rows, or null so [EnhancedListItem] falls
  /// back to its coloured icon tile when the item has no image.
  Widget? _productThumb(InventoryCatalogItem item) {
    final path = item.imagePath;
    if (path == null || path.isEmpty || !File(path).existsSync()) return null;
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Image.file(
        File(path),
        width: 56,
        height: 56,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => const SizedBox(width: 56, height: 56),
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
              '${item.category} • Stock: ${item.stock}'
              '${item.unit != null && item.unit!.isNotEmpty ? ' ${item.unit}' : ''}'
              ' • ${formatCurrency(item.price)}',
          leading: _productThumb(item),
          leadingIcon: Icons.inventory_2_rounded,
          leadingColor: item.isLowStock
              ? AppPalette.error
              : AppPalette.inventory,
          trailing: StatusBadge(
            label: item.isLowStock ? 'Low' : 'OK',
            color: item.isLowStock ? AppPalette.error : AppPalette.success,
          ),
          onTap: () => _showItemDetails(context, item),
        );
      },
    );
  }

  void _showItemDetails(BuildContext context, InventoryCatalogItem item) {
    final session = ref.read(mobileSessionProvider).asData?.value;
    final canManage =
        session != null && (session.isOwnerLike || session.isManager);
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
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _showRestockSheet(context, item);
                    },
                    icon: const Icon(Icons.add_box_rounded),
                    label: const Text('Restock'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _showAddItemSheet(context, existing: item);
                    },
                    icon: const Icon(Icons.edit_rounded),
                    label: const Text('Edit'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      _showAddItemSheet(context, duplicateOf: item);
                    },
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Duplicate'),
                  ),
                ),
                if (canManage)
                  Expanded(
                    child: TextButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _confirmDeleteItem(item);
                      },
                      icon: const Icon(Icons.delete_outline_rounded),
                      label: const Text('Delete'),
                      style: TextButton.styleFrom(
                        foregroundColor: AppPalette.error,
                      ),
                    ),
                  ),
              ],
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

  void _showAddItemSheet(
    BuildContext context, {
    InventoryCatalogItem? existing,
    InventoryCatalogItem? duplicateOf,
  }) {
    final isEdit = existing != null;
    final source = existing ?? duplicateOf;
    final formKey = GlobalKey<FormState>();
    final nameController = TextEditingController(
      text: source == null
          ? ''
          : (duplicateOf != null ? '${source.name} (copy)' : source.name),
    );
    final priceController = TextEditingController(
      text: source != null ? source.price.toStringAsFixed(2) : '',
    );
    final stockController = TextEditingController(
      text: '${duplicateOf != null ? 0 : (source?.stock ?? 0)}',
    );
    final categoryController = TextEditingController(
      text: source?.category ?? 'General',
    );
    final skuController = TextEditingController(
      text: duplicateOf != null ? '' : (source?.sku ?? ''),
    );
    final hsnController = TextEditingController(text: source?.hsnCode ?? '');
    final gstController = TextEditingController(
      text: source != null ? source.gstRate.toString() : '0',
    );
    final costController = TextEditingController(
      text: (source?.costPrice ?? 0) > 0
          ? source!.costPrice!.toStringAsFixed(2)
          : '',
    );
    final descriptionController = TextEditingController(
      text: source?.description ?? '',
    );
    final reorderController = TextEditingController(
      text: source?.reorderLevel != null ? '${source!.reorderLevel}' : '',
    );
    var selectedUnit = source?.unit ?? _unitOptions.first;
    if (!_unitOptions.contains(selectedUnit)) {
      selectedUnit = _unitOptions.first;
    }
    var priceIncludesTax = source?.priceIncludesTax ?? true;
    // A duplicate starts without a photo so it never shares (and later orphans)
    // the original's image file.
    String? imagePath = duplicateOf != null ? null : source?.imagePath;
    var isSaving = false;
    final imageStore = ProductImageStore();

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> pickImage(ImageSource src) async {
              try {
                final stored = await imageStore.pickAndStore(source: src);
                if (stored == null) return;
                setSheetState(() => imagePath = stored);
              } catch (error) {
                if (!sheetContext.mounted) return;
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  SnackBar(content: Text('Could not add photo: $error')),
                );
              }
            }

            void openPhotoOptions() {
              showModalBottomSheet<void>(
                context: sheetContext,
                builder: (optionsContext) => SafeArea(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ListTile(
                        leading: const Icon(Icons.photo_camera_rounded),
                        title: const Text('Take photo'),
                        onTap: () {
                          Navigator.pop(optionsContext);
                          pickImage(ImageSource.camera);
                        },
                      ),
                      ListTile(
                        leading: const Icon(Icons.photo_library_rounded),
                        title: const Text('Choose from gallery'),
                        onTap: () {
                          Navigator.pop(optionsContext);
                          pickImage(ImageSource.gallery);
                        },
                      ),
                      if (imagePath != null)
                        ListTile(
                          leading: const Icon(Icons.delete_outline_rounded),
                          title: const Text('Remove photo'),
                          onTap: () {
                            Navigator.pop(optionsContext);
                            setSheetState(() => imagePath = null);
                          },
                        ),
                    ],
                  ),
                ),
              );
            }

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
                final costText = costController.text.trim();
                final costPrice = costText.isEmpty
                    ? null
                    : double.tryParse(costText);
                final reorderText = reorderController.text.trim();
                final reorderLevel = reorderText.isEmpty
                    ? null
                    : int.tryParse(reorderText);
                final description = descriptionController.text.trim();

                final coordinator = ref.read(mobileSyncCoordinatorProvider);
                if (isEdit) {
                  await coordinator.updateInventoryItem(
                    itemId: existing.id,
                    name: nameController.text.trim(),
                    sellPrice: price,
                    stock: openingStock,
                    category: categoryController.text.trim(),
                    sku: skuController.text.trim(),
                    hsnCode: hsnController.text.trim(),
                    gstRate: gstRate,
                    priceIncludesTax: priceIncludesTax,
                    costPrice: costPrice ?? existing.costPrice,
                    size: existing.size ?? '',
                    subcategory: existing.subcategory ?? '',
                    description: description,
                    createdAt: existing.createdAt,
                    imagePath: imagePath,
                    unit: selectedUnit,
                    reorderLevel: reorderLevel,
                  );
                } else {
                  await coordinator.createInventoryItem(
                    name: nameController.text.trim(),
                    sellPrice: price,
                    openingStock: openingStock,
                    category: categoryController.text.trim(),
                    sku: skuController.text.trim(),
                    hsnCode: hsnController.text.trim(),
                    gstRate: gstRate,
                    priceIncludesTax: priceIncludesTax,
                    costPrice: costPrice,
                    description: description,
                    imagePath: imagePath,
                    unit: selectedUnit,
                    reorderLevel: reorderLevel,
                  );
                }

                if (!sheetContext.mounted) {
                  return;
                }
                Navigator.pop(sheetContext);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      '${nameController.text.trim()} ${isEdit ? 'updated' : 'added'}.',
                    ),
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
                            isEdit ? 'Edit Item' : 'Add New Item',
                            style: TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.w700,
                              color: AppColors.of(sheetContext).textPrimary,
                            ),
                          ),
                          const SizedBox(height: 24),
                          Center(
                            child: GestureDetector(
                              onTap: openPhotoOptions,
                              child: Container(
                                width: 104,
                                height: 104,
                                decoration: BoxDecoration(
                                  color: AppColors.of(sheetContext).surface,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: AppColors.of(sheetContext).border,
                                  ),
                                  image: imagePath != null
                                      ? DecorationImage(
                                          image: FileImage(File(imagePath!)),
                                          fit: BoxFit.cover,
                                        )
                                      : null,
                                ),
                                child: imagePath != null
                                    ? null
                                    : Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.add_a_photo_rounded,
                                            color: AppColors.of(
                                              sheetContext,
                                            ).textSecondary,
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            'Add photo',
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: AppColors.of(
                                                sheetContext,
                                              ).textSecondary,
                                            ),
                                          ),
                                        ],
                                      ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 20),
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
                            controller: costController,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: const InputDecoration(
                              labelText: 'Cost / purchase price (optional)',
                              helperText: 'Drives profit margin & valuation',
                            ),
                            validator: (value) {
                              final text = value?.trim() ?? '';
                              if (text.isEmpty) return null;
                              final parsed = double.tryParse(text);
                              if (parsed == null || parsed < 0) {
                                return 'Enter a valid cost price';
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
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Expanded(
                                child: DropdownButtonFormField<String>(
                                  initialValue: selectedUnit,
                                  isExpanded: true,
                                  decoration: const InputDecoration(
                                    labelText: 'Unit',
                                  ),
                                  items: <DropdownMenuItem<String>>[
                                    for (final u in _unitOptions)
                                      DropdownMenuItem<String>(
                                        value: u,
                                        child: Text(u),
                                      ),
                                  ],
                                  onChanged: (value) => setSheetState(
                                    () => selectedUnit = value ?? _unitOptions.first,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: reorderController,
                                  keyboardType: TextInputType.number,
                                  decoration: const InputDecoration(
                                    labelText: 'Reorder level',
                                    helperText: 'Low-stock alert',
                                  ),
                                  validator: (value) {
                                    final text = value?.trim() ?? '';
                                    if (text.isEmpty) return null;
                                    final parsed = int.tryParse(text);
                                    if (parsed == null || parsed < 0) {
                                      return 'Enter 0 or more';
                                    }
                                    return null;
                                  },
                                ),
                              ),
                            ],
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
                            decoration: InputDecoration(
                              labelText: 'SKU / barcode (optional)',
                              suffixIcon: IconButton(
                                icon: const Icon(
                                  Icons.qr_code_scanner_rounded,
                                ),
                                tooltip: 'Scan barcode',
                                onPressed: () async {
                                  final code = await showModalBottomSheet<String>(
                                    context: sheetContext,
                                    isScrollControlled: true,
                                    backgroundColor: Colors.transparent,
                                    builder: (_) => const PosScannerSheet(),
                                  );
                                  if (code != null && code.trim().isNotEmpty) {
                                    skuController.text = code.trim();
                                  }
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: descriptionController,
                            maxLines: 2,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: const InputDecoration(
                              labelText: 'Description / notes (optional)',
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
                            label: isSaving
                                ? 'Saving...'
                                : (isEdit ? 'Save Changes' : 'Create Item'),
                            icon: isEdit
                                ? Icons.check_rounded
                                : Icons.add_rounded,
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
      costController.dispose();
      descriptionController.dispose();
      reorderController.dispose();
    });
  }

  void _showRestockSheet(BuildContext context, InventoryCatalogItem item) {
    final qtyController = TextEditingController();
    final priceController = TextEditingController(
      text: item.price.toStringAsFixed(2),
    );
    var isSaving = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> save() async {
              final addQty = int.tryParse(qtyController.text.trim()) ?? 0;
              if (addQty <= 0 || isSaving) return;
              setSheetState(() => isSaving = true);
              try {
                final newPrice =
                    double.tryParse(priceController.text.trim()) ?? item.price;
                await ref
                    .read(mobileSyncCoordinatorProvider)
                    .updateInventoryItem(
                      itemId: item.id,
                      name: item.name,
                      sellPrice: newPrice,
                      stock: item.stock + addQty,
                      category: item.category,
                      sku: item.sku ?? '',
                      hsnCode: item.hsnCode ?? '',
                      gstRate: item.gstRate,
                      priceIncludesTax: item.priceIncludesTax,
                      costPrice: item.costPrice,
                      size: item.size ?? '',
                      subcategory: item.subcategory ?? '',
                      description: item.description ?? '',
                      createdAt: item.createdAt,
                    );
                if (!sheetContext.mounted) return;
                Navigator.pop(sheetContext);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      '${item.name}: +$addQty (now ${item.stock + addQty}).',
                    ),
                  ),
                );
              } catch (error) {
                if (!sheetContext.mounted) return;
                setSheetState(() => isSaving = false);
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  SnackBar(content: Text('Restock failed: $error')),
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
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.of(sheetContext).border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Restock',
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                          color: AppColors.of(sheetContext).textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${item.name} · current stock ${item.stock}',
                        style: TextStyle(
                          color: AppColors.of(sheetContext).textSecondary,
                        ),
                      ),
                      const SizedBox(height: 20),
                      TextField(
                        controller: qtyController,
                        keyboardType: TextInputType.number,
                        autofocus: true,
                        decoration: const InputDecoration(
                          labelText: 'Add quantity',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: priceController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Selling price',
                        ),
                      ),
                      const SizedBox(height: 20),
                      PrimaryActionButton(
                        label: isSaving ? 'Saving...' : 'Add stock',
                        icon: Icons.add_box_rounded,
                        onPressed: isSaving ? null : save,
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    ).whenComplete(() {
      qtyController.dispose();
      priceController.dispose();
    });
  }

  Future<void> _confirmDeleteItem(InventoryCatalogItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Delete item?'),
        content: Text('${item.name} will be removed from your inventory.'),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            style: FilledButton.styleFrom(backgroundColor: AppPalette.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(mobileSyncCoordinatorProvider)
          .deleteInventoryItem(itemId: item.id, name: item.name);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${item.name} deleted.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Delete failed: $error')),
      );
    }
  }

  void _showBulkAddSheet(BuildContext context) {
    final rows = <_BulkRow>[_BulkRow(), _BulkRow(), _BulkRow()];
    var isSaving = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> save() async {
              final valid = rows
                  .where(
                    (r) =>
                        r.name.text.trim().isNotEmpty &&
                        (double.tryParse(r.price.text.trim()) ?? 0) > 0,
                  )
                  .toList();
              if (valid.isEmpty || isSaving) {
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  const SnackBar(
                    content: Text('Enter at least one item name and price.'),
                  ),
                );
                return;
              }
              setSheetState(() => isSaving = true);
              try {
                final coordinator = ref.read(mobileSyncCoordinatorProvider);
                for (final r in valid) {
                  await coordinator.createInventoryItem(
                    name: r.name.text.trim(),
                    sellPrice: double.parse(r.price.text.trim()),
                    openingStock: int.tryParse(r.qty.text.trim()) ?? 0,
                  );
                }
                if (!sheetContext.mounted) return;
                Navigator.pop(sheetContext);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      '${valid.length} item${valid.length == 1 ? '' : 's'} added.',
                    ),
                  ),
                );
              } catch (error) {
                if (!sheetContext.mounted) return;
                setSheetState(() => isSaving = false);
                ScaffoldMessenger.of(sheetContext).showSnackBar(
                  SnackBar(content: Text('Bulk add failed: $error')),
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
                padding: const EdgeInsets.all(20),
                child: SafeArea(
                  top: false,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: AppColors.of(sheetContext).border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      const Text(
                        'Bulk add items',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Name and price required. Quantity optional.',
                        style: TextStyle(
                          color: AppColors.of(sheetContext).textSecondary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Flexible(
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: rows.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (context, index) {
                            final r = rows[index];
                            return Row(
                              children: [
                                Expanded(
                                  flex: 4,
                                  child: TextField(
                                    controller: r.name,
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      hintText: 'Item name',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 2,
                                  child: TextField(
                                    controller: r.price,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                          decimal: true,
                                        ),
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      hintText: 'Price',
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  flex: 2,
                                  child: TextField(
                                    controller: r.qty,
                                    keyboardType: TextInputType.number,
                                    decoration: const InputDecoration(
                                      isDense: true,
                                      hintText: 'Qty',
                                    ),
                                  ),
                                ),
                                IconButton(
                                  onPressed: rows.length <= 1
                                      ? null
                                      : () => setSheetState(
                                          () => rows.removeAt(index).dispose(),
                                        ),
                                  icon: const Icon(
                                    Icons.remove_circle_outline_rounded,
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () =>
                              setSheetState(() => rows.add(_BulkRow())),
                          icon: const Icon(Icons.add_rounded),
                          label: const Text('Add row'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      PrimaryActionButton(
                        label: isSaving ? 'Importing...' : 'Import items',
                        icon: Icons.playlist_add_check_rounded,
                        onPressed: isSaving ? null : save,
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    ).whenComplete(() {
      for (final r in rows) {
        r.dispose();
      }
    });
  }
}

class _BulkRow {
  final TextEditingController name = TextEditingController();
  final TextEditingController price = TextEditingController();
  final TextEditingController qty = TextEditingController();

  void dispose() {
    name.dispose();
    price.dispose();
    qty.dispose();
  }
}
