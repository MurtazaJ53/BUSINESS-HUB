import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
import 'checkout_payment_sheet.dart';
import 'pos_scanner_sheet.dart';

/// Point of Sale — clean product list, editable cart, prominent total.
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
  bool _saving = false;

  static const int _pageSize = 50;

  double get _cartTotal =>
      _cart.fold<double>(0, (sum, item) => sum + item.lineTotal);
  int get _cartCount => _cart.fold<int>(0, (sum, item) => sum + item.quantity);
  GstCartSummary get _gstSummary => computeCartGst(_cart);

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  // ---- cart mutations -------------------------------------------------------

  void _addToCart(InventoryCatalogItem item) {
    setState(() {
      final index = _cart.indexWhere((c) => c.id == item.id);
      if (index >= 0) {
        _cart[index] = _cart[index].copyWith(
          quantity: _cart[index].quantity + 1,
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
    HapticFeedback.selectionClick();
  }

  void _changeQtyById(String id, int delta) {
    setState(() {
      final index = _cart.indexWhere((c) => c.id == id);
      if (index < 0) return;
      final next = _cart[index].quantity + delta;
      if (next <= 0) {
        _cart.removeAt(index);
      } else {
        _cart[index] = _cart[index].copyWith(quantity: next);
      }
    });
  }

  int _qtyInCart(String id) {
    final index = _cart.indexWhere((c) => c.id == id);
    return index < 0 ? 0 : _cart[index].quantity;
  }

  // ---- actions --------------------------------------------------------------

  Future<void> _openScanner(List<InventoryCatalogItem> items) async {
    final code = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const PosScannerSheet(),
    );
    if (code == null || code.trim().isEmpty || !mounted) return;
    final needle = code.trim().toLowerCase();
    final match = items.where((item) {
      final sku = item.sku?.toLowerCase() ?? '';
      return sku == needle || item.id.toLowerCase() == needle;
    }).toList();
    if (match.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('No product matches "$code".')),
      );
      return;
    }
    _addToCart(match.first);
  }

  Future<void> _openCart() async {
    final action = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CartSheet(
        cart: _cart,
        onChangeQty: _changeQtyById,
        gstSummary: () => _gstSummary,
        total: () => _cartTotal,
      ),
    );
    setState(() {}); // reflect any edits made inside the sheet
    if (action == 'checkout' && mounted) {
      await _openCheckout();
    }
  }

  Future<void> _openCheckout() async {
    final session = ref.read(mobileSessionProvider).asData?.value;
    final shop = ref.read(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final salesRepository = ref.read(salesRepositoryProvider);
    final syncCoordinator = ref.read(mobileSyncCoordinatorProvider);
    final activeShopId = session?.shopId;

    if (activeShopId == null || activeShopId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Shop session is still loading.')),
      );
      return;
    }
    if (_cart.isEmpty) return;

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) =>
          CheckoutPaymentSheet(cartTotal: _cartTotal, gstSummary: _gstSummary),
    );
    if (result == null || !mounted) return;

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
      if (!mounted) return;
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
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sale failed: $error'),
          backgroundColor: AppPalette.error,
        ),
      );
    }
  }

  // ---- build ----------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final categories =
        ref.watch(inventoryCategoriesProvider).asData?.value ??
        const <InventoryCategorySummary>[];

    final catalogFilter = PosCatalogFilter(
      search: _search,
      category: _selectedCategory,
      page: 1,
      pageSize: _pageSize,
      includeCost: session?.canViewCost ?? false,
    );
    final items =
        ref.watch(posCatalogPageProvider(catalogFilter)).asData?.value ??
        const <InventoryCatalogItem>[];

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: <Widget>[
            _buildHeader(context, items),
            if (categories.isNotEmpty) _buildCategoryFilters(categories),
            const SizedBox(height: 4),
            Expanded(
              child: items.isEmpty
                  ? _EmptyCatalog(searching: _search.isNotEmpty)
                  : ListView.separated(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        8,
                        16,
                        _cart.isEmpty ? 24 : 108,
                      ),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, index) {
                        final item = items[index];
                        return _ProductRow(
                          item: item,
                          qtyInCart: _qtyInCart(item.id),
                          onAdd: () => _addToCart(item),
                          onInc: () => _changeQtyById(item.id, 1),
                          onDec: () => _changeQtyById(item.id, -1),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _cart.isEmpty
          ? null
          : _CartBar(
              count: _cartCount,
              total: _cartTotal,
              saving: _saving,
              onTap: _openCart,
            ),
    );
  }

  Widget _buildHeader(BuildContext context, List<InventoryCatalogItem> items) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            'Point of Sale',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: <Widget>[
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (value) => setState(() => _search = value),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Search by name, SKU or barcode',
                    prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: _search.isEmpty
                        ? null
                        : IconButton(
                            icon: const Icon(Icons.close_rounded),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _search = '');
                            },
                          ),
                    filled: true,
                    fillColor: colors.surface,
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              _ScanButton(onTap: () => _openScanner(items)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryFilters(List<InventoryCategorySummary> categories) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: categories.length + 1,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == 0) {
            return _CategoryChip(
              label: 'All',
              selected: _selectedCategory == null,
              onTap: () => setState(() => _selectedCategory = null),
            );
          }
          final category = categories[index - 1].category;
          return _CategoryChip(
            label: category,
            selected: _selectedCategory == category,
            onTap: () => setState(() => _selectedCategory = category),
          );
        },
      ),
    );
  }
}

// ---- product row ------------------------------------------------------------

class _ProductRow extends StatelessWidget {
  const _ProductRow({
    required this.item,
    required this.qtyInCart,
    required this.onAdd,
    required this.onInc,
    required this.onDec,
  });

  final InventoryCatalogItem item;
  final int qtyInCart;
  final VoidCallback onAdd;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    final lowStock = item.stock <= 5;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: qtyInCart > 0
              ? AppPalette.primary.withValues(alpha: 0.5)
              : colors.borderSoft,
          width: qtyInCart > 0 ? 1.5 : 1,
        ),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          _ProductTile(name: item.name),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  item.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: <Widget>[
                    if (item.sku != null && item.sku!.isNotEmpty) ...<Widget>[
                      Flexible(
                        child: Text(
                          item.sku!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.textTertiary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text('·', style: TextStyle(color: colors.textTertiary)),
                      const SizedBox(width: 8),
                    ],
                    Text(
                      '${item.stock} in stock',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: lowStock ? AppPalette.warning : colors.textTertiary,
                        fontWeight: lowStock ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  formatCurrency(item.price),
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppPalette.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          qtyInCart > 0
              ? _QtyStepper(quantity: qtyInCart, onInc: onInc, onDec: onDec)
              : _AddButton(onTap: onAdd),
        ],
      ),
    );
  }
}

class _ProductTile extends StatelessWidget {
  const _ProductTile({required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    final letter = name.trim().isEmpty ? '?' : name.trim()[0].toUpperCase();
    return Container(
      width: 52,
      height: 52,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppPalette.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Text(
        letter,
        style: const TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w800,
          color: AppPalette.primary,
        ),
      ),
    );
  }
}

class _AddButton extends StatelessWidget {
  const _AddButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppPalette.primary,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: const SizedBox(
          width: 46,
          height: 46,
          child: Icon(Icons.add_rounded, color: Colors.white, size: 26),
        ),
      ),
    );
  }
}

class _QtyStepper extends StatelessWidget {
  const _QtyStepper({
    required this.quantity,
    required this.onInc,
    required this.onDec,
  });

  final int quantity;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppPalette.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppPalette.primary.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _StepButton(icon: Icons.remove_rounded, onTap: onDec),
          SizedBox(
            width: 30,
            child: Text(
              '$quantity',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 16,
                color: AppPalette.primary,
              ),
            ),
          ),
          _StepButton(icon: Icons.add_rounded, onTap: onInc),
        ],
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 40,
        height: 44,
        child: Icon(icon, size: 20, color: AppPalette.primary),
      ),
    );
  }
}

class _ScanButton extends StatelessWidget {
  const _ScanButton({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppPalette.primary,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: const SizedBox(
          width: 54,
          height: 54,
          child: Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 26),
        ),
      ),
    );
  }
}

class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: selected ? AppPalette.primary : colors.surface,
      borderRadius: BorderRadius.circular(22),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(22),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(
              color: selected ? AppPalette.primary : colors.borderSoft,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: selected ? Colors.white : colors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}

// ---- docked cart bar --------------------------------------------------------

class _CartBar extends StatelessWidget {
  const _CartBar({
    required this.count,
    required this.total,
    required this.saving,
    required this.onTap,
  });

  final int count;
  final double total;
  final bool saving;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      minimum: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Material(
        color: AppPalette.primary,
        borderRadius: BorderRadius.circular(20),
        elevation: 8,
        shadowColor: AppPalette.primary.withValues(alpha: 0.4),
        child: InkWell(
          onTap: saving ? null : onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            child: Row(
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.shopping_bag_rounded,
                    color: Colors.white,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '$count item${count == 1 ? '' : 's'}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const Spacer(),
                if (saving)
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                else ...<Widget>[
                  Text(
                    formatCurrency(total),
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 18,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_rounded, color: Colors.white),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---- order summary sheet ----------------------------------------------------

class _CartSheet extends StatefulWidget {
  const _CartSheet({
    required this.cart,
    required this.onChangeQty,
    required this.gstSummary,
    required this.total,
  });

  final List<PosCartItem> cart;
  final void Function(String id, int delta) onChangeQty;
  final GstCartSummary Function() gstSummary;
  final double Function() total;

  @override
  State<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends State<_CartSheet> {
  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    final gst = widget.gstSummary();
    final total = widget.total();

    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          ),
          child: Column(
            children: <Widget>[
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
                child: Row(
                  children: <Widget>[
                    Text(
                      'Order summary',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '${widget.cart.length} line${widget.cart.length == 1 ? '' : 's'}',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: colors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: widget.cart.isEmpty
                    ? Center(
                        child: Text(
                          'Cart is empty',
                          style: theme.textTheme.bodyLarge?.copyWith(
                            color: colors.textTertiary,
                          ),
                        ),
                      )
                    : ListView.separated(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                        itemCount: widget.cart.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final line = widget.cart[index];
                          return _CartLine(
                            line: line,
                            onInc: () {
                              widget.onChangeQty(line.id, 1);
                              setState(() {});
                            },
                            onDec: () {
                              widget.onChangeQty(line.id, -1);
                              setState(() {});
                            },
                          );
                        },
                      ),
              ),
              _CartFooter(gst: gst, total: total, onPay: widget.cart.isEmpty
                  ? null
                  : () => Navigator.of(context).pop('checkout')),
            ],
          ),
        );
      },
    );
  }
}

class _CartLine extends StatelessWidget {
  const _CartLine({required this.line, required this.onInc, required this.onDec});

  final PosCartItem line;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.borderSoft),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          _ProductTile(name: line.name),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  line.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${formatCurrency(line.price)} each',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: colors.textTertiary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  formatCurrency(line.lineTotal),
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: AppPalette.primary,
                  ),
                ),
              ],
            ),
          ),
          _QtyStepper(quantity: line.quantity, onInc: onInc, onDec: onDec),
        ],
      ),
    );
  }
}

class _CartFooter extends StatelessWidget {
  const _CartFooter({required this.gst, required this.total, required this.onPay});

  final GstCartSummary gst;
  final double total;
  final VoidCallback? onPay;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border(top: BorderSide(color: colors.borderSoft)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        16,
        20,
        16 + MediaQuery.of(context).padding.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          _SummaryRow(label: 'Subtotal', value: formatCurrency(gst.taxableAmount)),
          if (gst.hasTax) ...<Widget>[
            const SizedBox(height: 6),
            _SummaryRow(label: 'Tax', value: formatCurrency(gst.taxAmount)),
          ],
          const SizedBox(height: 10),
          Row(
            children: <Widget>[
              Text(
                'Total',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                formatCurrency(total),
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w900,
                  color: AppPalette.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: FilledButton.icon(
              onPressed: onPay,
              icon: const Icon(Icons.point_of_sale_rounded),
              label: const Text(
                'Process payment',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Row(
      children: <Widget>[
        Text(
          label,
          style: theme.textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
        ),
        const Spacer(),
        Text(
          value,
          style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
        ),
      ],
    );
  }
}

class _EmptyCatalog extends StatelessWidget {
  const _EmptyCatalog({required this.searching});

  final bool searching;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Container(
              width: 88,
              height: 88,
              decoration: BoxDecoration(
                color: AppPalette.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(28),
              ),
              child: Icon(
                searching ? Icons.search_off_rounded : Icons.inventory_2_rounded,
                size: 40,
                color: AppPalette.primary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              searching ? 'No products found' : 'No products yet',
              style: theme.textTheme.titleLarge?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              searching
                  ? 'Try a different name, SKU or barcode.'
                  : 'Add products in Inventory to start selling.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: colors.textTertiary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
