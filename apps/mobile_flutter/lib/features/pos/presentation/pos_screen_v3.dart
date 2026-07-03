import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';
import '../../../core/tax/gst.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/premium_components.dart';
import 'package:google_fonts/google_fonts.dart';

/// Redesigned POS Screen v3.0
/// Simple, Clean, Premium, Professional
class PosScreenV3 extends ConsumerStatefulWidget {
  const PosScreenV3({super.key});

  @override
  ConsumerState<PosScreenV3> createState() => _PosScreenV3State();
}

class _PosScreenV3State extends ConsumerState<PosScreenV3> {
  final TextEditingController _searchController = TextEditingController();
  final List<PosCartItem> _cart = <PosCartItem>[];

  String _search = '';
  String? _selectedCategory;
  int _page = 1;
  bool _saving = false;

  static const int _pageSize = 20;

  double get _cartTotal =>
      _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);
  GstCartSummary get _gstSummary => computeCartGst(_cart);

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final categories =
        ref.watch(inventoryCategoriesProvider).asData?.value ??
        const <InventoryCategorySummary>[];

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

    return Scaffold(
      backgroundColor: AppColors.of(context).background,
      body: SafeArea(
        child: Column(
          children: [
            // Header with search
            _buildHeader(context),

            // Cart summary (sticky)
            if (_cart.isNotEmpty) _buildCartSummary(context),

            // Category filters
            if (categories.isNotEmpty) _buildCategoryFilters(categories),

            // Product grid
            Expanded(
              child: items.isEmpty
                  ? EmptyStateWidget(
                      icon: Icons.search_off_rounded,
                      title: 'No products found',
                      message: _search.isEmpty
                          ? 'Start typing to search products'
                          : 'Try a different search term',
                    )
                  : _buildProductGrid(items),
            ),
          ],
        ),
      ),
      // Checkout FAB
      floatingActionButton: _cart.isEmpty
          ? null
          : Container(
              margin: const EdgeInsets.symmetric(horizontal: 20),
              width: double.infinity,
              height: 64,
              child: FloatingActionButton.extended(
                onPressed: () => _openCheckout(context),
                backgroundColor: AppPalette.primary,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(32),
                ),
                elevation: 12,
                icon: const Icon(Icons.shopping_bag_rounded, size: 24, color: Colors.white),
                label: Text(
                  'Checkout ${formatCurrency(_cartTotal)}',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.2,
                    color: Colors.white,
                  ),
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
                'Point of Sale',
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
            hintText: 'Search products...',
            onChanged: (value) {
              setState(() {
                _search = value;
                _page = 1;
              });
            },
            onClear: () {
              setState(() {
                _search = '';
                _page = 1;
              });
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCartSummary(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: AppPalette.success.withValues(alpha: 0.1),
        border: Border(
          bottom: BorderSide(
            color: AppPalette.success.withValues(alpha: 0.2),
            width: 1,
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppPalette.success,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.shopping_bag_rounded,
              size: 20,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatCurrency(_cartTotal),
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.of(context).textPrimary,
                  ),
                ),
                Text(
                  '${_cart.length} item${_cart.length == 1 ? '' : 's'} in cart',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: AppColors.of(context).textSecondary,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                _cart.clear();
              });
            },
            child: Text('Clear'),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryFilters(List<InventoryCategorySummary> categories) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.of(context).surface,
        border: Border(
          bottom: BorderSide(color: AppColors.of(context).borderSoft, width: 1),
        ),
      ),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
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
                  _page = 1;
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
                _page = 1;
              });
            },
          );
        },
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
      borderRadius: BorderRadius.circular(24),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          child: Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isSelected ? Colors.white : AppColors.of(context).textSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProductGrid(List<InventoryCatalogItem> items) {
    return GridView.builder(
      padding: const EdgeInsets.all(20),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 0.75,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _buildProductCard(item);
      },
    );
  }

  Widget _buildProductCard(InventoryCatalogItem item) {
    final inCart = _cart.any((cartItem) => cartItem.id == item.id);

    return InkWell(
      onTap: () => _addToCart(item),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: inCart ? AppPalette.primary.withValues(alpha: 0.1) : AppColors.of(context).surface,
          border: Border.all(
            color: inCart ? AppPalette.primary : AppColors.of(context).border,
            width: inCart ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.name,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (item.sku.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                item.sku,
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.of(context).textSecondary,
                ),
              ),
            ],
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  formatCurrency(item.price),
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: inCart ? AppPalette.primary : AppColors.of(context).textPrimary,
                  ),
                ),
                Text(
                  'Qty: ${item.stock}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: item.stock > 5 ? AppColors.of(context).textSecondary : AppPalette.warning,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _addToCart(InventoryCatalogItem item) {
    setState(() {
      final existingIndex = _cart.indexWhere(
        (cartItem) => cartItem.id == item.id,
      );

      if (existingIndex >= 0) {
        final existing = _cart[existingIndex];
        _cart[existingIndex] = existing.copyWith(
          quantity: existing.quantity + 1,
        );
      } else {
        _cart.add(
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
            hsnCode: item.hsnCode,
            gstRate: item.gstRate,
            priceIncludesTax: item.priceIncludesTax,
          ),
        );
      }
    });
  }

import 'checkout_payment_sheet.dart';

  void _openCheckout(BuildContext context) async {
    final session = ref.read(mobileSessionProvider).asData?.value;
    final shop = ref.read(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final salesRepository = ref.read(salesRepositoryProvider);
    final syncCoordinator = ref.read(mobileSyncCoordinatorProvider);
    final activeShopId = session?.shopId;

    if (activeShopId == null || activeShopId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Shop session is still loading.')));
      return;
    }

    // 1. Show the robust Payment Sheet
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CheckoutPaymentSheet(
        cartTotal: _cartTotal,
        gstSummary: _gstSummary,
      ),
    );

    if (result == null || !mounted || !context.mounted) return;

    // 2. Extract checkout data
    final payments = result['payments'] as List<PosPayment>;
    final paymentMode = result['paymentMode'] as String;
    final buyerGstin = result['buyerGstin'] as String?;

    setState(() => _saving = true);

    try {
      final commit = await salesRepository.recordLocalSale(
        shopId: activeShopId,
        items: List<PosCartItem>.from(_cart),
        payments: payments,
        paymentMode: paymentMode,
        footerNote: shop.footer,
        buyerGstin: buyerGstin,
      );
      
      final syncResult = await syncCoordinator.submitSale(commit);
      
      if (!mounted || !context.mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            syncResult.acceptedByBackend
                ? 'Sale synced: ${formatCurrency(commit.total)}'
                : 'Sale queued: ${formatCurrency(commit.total)}',
          ),
          backgroundColor: AppPalette.success,
        ),
      );
      
      setState(() {
        _cart.clear();
        _saving = false;
      });
      
    } catch (error) {
      if (!mounted || !context.mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sale failed: $error'), backgroundColor: AppPalette.error),
      );
    }
  }
}

class _CheckoutRow extends StatelessWidget {
  const _CheckoutRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: AppColors.of(context).textSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            color: AppColors.of(context).textPrimary,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}
