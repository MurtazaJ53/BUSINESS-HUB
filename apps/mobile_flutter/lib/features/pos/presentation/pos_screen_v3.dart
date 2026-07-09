import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/pos/cart_pricing.dart';
import '../../../core/pos/held_sales.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/providers/printer_provider.dart';
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
  final TextEditingController _discountController = TextEditingController();
  final TextEditingController _customerNameController = TextEditingController();
  final TextEditingController _customerPhoneController = TextEditingController();
  final List<PosCartItem> _cart = <PosCartItem>[];

  String _search = '';
  String? _selectedCategory;
  bool _saving = false;
  bool _discountIsPercent = false;
  DateTime? _saleDate; // null = today

  static const int _pageSize = 50;

  double get _cartTotal => CartPricing.subtotal(_cart);
  int get _cartCount => _cart.fold<int>(0, (sum, item) => sum + item.quantity);

  // GST is computed on the discounted (net) cart so the tax shown matches the
  // amount actually charged.
  GstCartSummary get _gstSummary =>
      computeCartGst(_cart, discount: _discountAmount);

  double get _discountAmount => CartPricing.discountAmount(
    subtotal: _cartTotal,
    value: double.tryParse(_discountController.text.trim()) ?? 0,
    isPercent: _discountIsPercent,
  );

  double get _netTotal =>
      CartPricing.net(subtotal: _cartTotal, discount: _discountAmount);

  @override
  void dispose() {
    _searchController.dispose();
    _discountController.dispose();
    _customerNameController.dispose();
    _customerPhoneController.dispose();
    super.dispose();
  }

  Future<void> _addCustomItem() async {
    final nameController = TextEditingController();
    final priceController = TextEditingController();
    final added = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Custom item'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            TextField(
              controller: nameController,
              textCapitalization: TextCapitalization.words,
              decoration: const InputDecoration(labelText: 'Item name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: priceController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Price'),
            ),
          ],
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    final name = nameController.text.trim();
    final price = double.tryParse(priceController.text.trim()) ?? 0;
    nameController.dispose();
    priceController.dispose();
    if (added != true || name.isEmpty || price <= 0) return;
    setState(() {
      _cart.add(
        PosCartItem(
          id: 'custom-${DateTime.now().microsecondsSinceEpoch}',
          name: name,
          price: price,
          quantity: 1,
          stock: 999999,
          category: 'Custom',
        ),
      );
    });
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

  void _holdCurrentSale() {
    if (_cart.isEmpty) return;
    ref
        .read(heldSalesProvider.notifier)
        .hold(
          HeldSale(
            id: 'held-${DateTime.now().microsecondsSinceEpoch}',
            items: List<PosCartItem>.from(_cart),
            discountText: _discountController.text,
            discountIsPercent: _discountIsPercent,
            customerName: _customerNameController.text,
            customerPhone: _customerPhoneController.text,
            saleDate: _saleDate,
            heldAt: DateTime.now(),
          ),
        );
    _discountController.clear();
    _customerNameController.clear();
    _customerPhoneController.clear();
    setState(() {
      _cart.clear();
      _discountIsPercent = false;
      _saleDate = null;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Sale held.')),
    );
  }

  void _resumeHeldSale(HeldSale held) {
    _discountController.text = held.discountText;
    _customerNameController.text = held.customerName;
    _customerPhoneController.text = held.customerPhone;
    setState(() {
      _cart
        ..clear()
        ..addAll(held.items);
      _discountIsPercent = held.discountIsPercent;
      _saleDate = held.saleDate;
    });
    ref.read(heldSalesProvider.notifier).remove(held.id);
  }

  Future<void> _showHeldSales() async {
    final held = ref.read(heldSalesProvider);
    if (held.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final colors = AppColors.of(sheetContext);
        return Container(
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.fromLTRB(18, 12, 18, 24),
          child: SafeArea(
            top: false,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Held sales',
                  style: Theme.of(sheetContext).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 12),
                ...held.map(
                  (h) => Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: colors.borderSoft),
                    ),
                    child: ListTile(
                      onTap: () {
                        Navigator.pop(sheetContext);
                        _resumeHeldSale(h);
                      },
                      leading: const Icon(
                        Icons.pause_circle_filled_rounded,
                        color: AppPalette.primary,
                      ),
                      title: Text(
                        h.label,
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        '${h.itemCount} item${h.itemCount == 1 ? '' : 's'} · ${formatCurrency(h.total)}',
                      ),
                      trailing: IconButton(
                        icon: const Icon(Icons.delete_outline_rounded),
                        color: AppPalette.error,
                        onPressed: () {
                          ref.read(heldSalesProvider.notifier).remove(h.id);
                          Navigator.pop(sheetContext);
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

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
        grossTotal: () => _cartTotal,
        discountAmount: () => _discountAmount,
        netTotal: () => _netTotal,
        discountController: _discountController,
        isPercent: () => _discountIsPercent,
        onToggleType: () =>
            setState(() => _discountIsPercent = !_discountIsPercent),
        customerNameController: _customerNameController,
        customerPhoneController: _customerPhoneController,
        saleDate: () => _saleDate,
        onPickDate: () async {
          final picked = await showDatePicker(
            context: context,
            initialDate: _saleDate ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime.now(),
          );
          if (picked != null && mounted) {
            setState(() => _saleDate = picked);
          }
        },
        onPickCustomer: _pickCustomer,
      ),
    );
    setState(() {}); // reflect any edits made inside the sheet
    if (action == 'checkout' && mounted) {
      await _openCheckout();
    }
  }

  /// When a sale leaves a balance due, attach it to a real customer (matched
  /// by phone, or created) so the due lands in the Clients khata. Returns the
  /// customer id to record on the sale, or null for a fully-paid walk-in.
  Future<String?> _resolveCustomerForSale({
    required List<PosPayment> payments,
    required String customerName,
    required String customerPhone,
  }) async {
    final paid = payments.fold<double>(0, (sum, p) => sum + p.amount);
    final saleDue = _netTotal - paid;
    final hasCustomer = customerName.isNotEmpty || customerPhone.isNotEmpty;
    if (saleDue <= 0.009 || !hasCustomer) {
      return null;
    }

    final existing =
        ref.read(customersProvider).asData?.value ??
        const <BackendCustomerSummary>[];
    if (customerPhone.isNotEmpty) {
      for (final c in existing) {
        if ((c.phone ?? '').trim() == customerPhone) {
          return c.id;
        }
      }
    }

    final now = DateTime.now();
    final id = 'local-cust-${now.microsecondsSinceEpoch}';
    await ref.read(customerRepositoryProvider).mergeRemoteCustomerDocument(
      id,
      <String, dynamic>{
        'name': customerName.isEmpty ? 'Customer' : customerName,
        'phone': customerPhone,
        'status': 'active',
        'balance': 0,
        'total_spent': 0,
        'tombstone': false,
        'updatedAt': now.toIso8601String(),
      },
      updatedAt: now.millisecondsSinceEpoch,
    );
    return id;
  }

  Future<void> _pickCustomer() async {
    final all =
        ref.read(customersProvider).asData?.value ??
        const <BackendCustomerSummary>[];
    final searchController = TextEditingController();
    final selected = await showModalBottomSheet<BackendCustomerSummary>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final colors = AppColors.of(sheetContext);
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            final q = searchController.text.trim().toLowerCase();
            final filtered = q.isEmpty
                ? all
                : all
                      .where(
                        (c) =>
                            c.name.toLowerCase().contains(q) ||
                            (c.phone ?? '').contains(q),
                      )
                      .toList(growable: false);
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(sheetContext).bottom,
              ),
              child: Container(
                decoration: BoxDecoration(
                  color: colors.background,
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(24),
                  ),
                ),
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 18),
                child: SafeArea(
                  top: false,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: colors.border,
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Choose customer',
                        style: Theme.of(sheetContext).textTheme.titleLarge
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: searchController,
                        onChanged: (_) => setSheetState(() {}),
                        decoration: const InputDecoration(
                          hintText: 'Search name or phone',
                          prefixIcon: Icon(Icons.search_rounded),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Flexible(
                        child: filtered.isEmpty
                            ? const Padding(
                                padding: EdgeInsets.all(24),
                                child: Text('No customers found.'),
                              )
                            : ListView(
                                shrinkWrap: true,
                                children: filtered
                                    .map(
                                      (c) => ListTile(
                                        leading: const Icon(
                                          Icons.person_rounded,
                                        ),
                                        title: Text(
                                          c.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        subtitle: Text(
                                          '${c.phone ?? ''}${c.balance > 0 ? ' · due ${formatCurrency(c.balance)}' : ''}',
                                        ),
                                        onTap: () =>
                                            Navigator.pop(sheetContext, c),
                                      ),
                                    )
                                    .toList(growable: false),
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
    searchController.dispose();
    if (selected != null) {
      _customerNameController.text = selected.name;
      _customerPhoneController.text = selected.phone ?? '';
      if (mounted) setState(() {});
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
          CheckoutPaymentSheet(cartTotal: _netTotal, gstSummary: _gstSummary),
    );
    if (result == null || !mounted) return;

    final payments = result['payments'] as List<PosPayment>;
    final paymentMode = result['paymentMode'] as String;
    final buyerGstin = result['buyerGstin'] as String?;
    final customerName = _customerNameController.text.trim();
    final customerPhone = _customerPhoneController.text.trim();

    setState(() => _saving = true);
    try {
      final customerId = await _resolveCustomerForSale(
        payments: payments,
        customerName: customerName,
        customerPhone: customerPhone,
      );
      final commit = await salesRepository.recordLocalSale(
        shopId: activeShopId,
        items: List<PosCartItem>.from(_cart),
        payments: payments,
        paymentMode: paymentMode,
        footerNote: shop.footer,
        buyerGstin: buyerGstin,
        discount: _discountAmount,
        customerId: customerId,
        customerName: customerName.isEmpty ? null : customerName,
        customerPhone: customerPhone.isEmpty ? null : customerPhone,
        saleDate: _saleDate,
      );
      if (!mounted) return;
      // Local-first: the sale is committed to the device now, so confirm and
      // reset immediately. Backend sync runs in the background (its result is
      // reflected by the sync status chip), so checkout never waits on the
      // network.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Sale saved: ${formatCurrency(commit.total)}'),
          backgroundColor: AppPalette.success,
        ),
      );
      _discountController.clear();
      _customerNameController.clear();
      _customerPhoneController.clear();
      setState(() {
        _cart.clear();
        _discountIsPercent = false;
        _saleDate = null;
        _saving = false;
      });
      unawaited(syncCoordinator.submitSale(commit));
      if (mounted) await _showReceiptSheet(commit);
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

  Future<void> _showReceiptSheet(LocalSaleCommit commit) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        final colors = AppColors.of(sheetContext);
        var printing = false;
        return StatefulBuilder(
          builder: (sheetContext, setSheetState) {
            Future<void> printReceipt() async {
              if (printing) return;
              setSheetState(() => printing = true);
              try {
                final detail = await ref
                    .read(salesRepositoryProvider)
                    .getSaleDetail(commit.saleId);
                final shop = ref.read(shopInfoProvider).asData?.value;
                if (detail == null || shop == null) {
                  throw Exception('Receipt detail is not available yet.');
                }
                final printer = ref.read(receiptPrinterProvider);
                final devices = await printer.getDevices();
                if (devices.isEmpty) {
                  if (sheetContext.mounted) {
                    setSheetState(() => printing = false);
                    ScaffoldMessenger.of(sheetContext).showSnackBar(
                      const SnackBar(
                        content: Text('No paired Bluetooth printer found.'),
                      ),
                    );
                  }
                  return;
                }
                await printer.connect(devices.first);
                await printer.printTaxInvoice(detail, shop);
                await printer.disconnect();
                if (sheetContext.mounted) {
                  Navigator.pop(sheetContext);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Receipt printed.')),
                  );
                }
              } catch (error) {
                if (sheetContext.mounted) {
                  setSheetState(() => printing = false);
                  ScaffoldMessenger.of(sheetContext).showSnackBar(
                    SnackBar(content: Text('Print failed: $error')),
                  );
                }
              }
            }

            return Container(
              decoration: BoxDecoration(
                color: colors.background,
                borderRadius:
                    const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              padding: const EdgeInsets.all(24),
              child: SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: AppPalette.success.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.check_circle_rounded,
                        color: AppPalette.success,
                        size: 36,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Sale complete',
                      style: Theme.of(sheetContext).textTheme.headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatCurrency(commit.total),
                      style: Theme.of(sheetContext).textTheme.titleLarge
                          ?.copyWith(
                            fontWeight: FontWeight.w800,
                            color: AppPalette.primary,
                          ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: FilledButton.icon(
                        onPressed: printing ? null : printReceipt,
                        icon: printing
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.print_rounded),
                        label: Text(printing ? 'Printing...' : 'Print receipt'),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      height: 54,
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.pop(sheetContext),
                        icon: const Icon(Icons.check_rounded),
                        label: const Text('Done'),
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
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
          Row(
            children: <Widget>[
              Text(
                'Point of Sale',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.4,
                ),
              ),
              const Spacer(),
              if (ref.watch(heldSalesProvider).isNotEmpty)
                TextButton.icon(
                  onPressed: _showHeldSales,
                  icon: const Icon(Icons.inventory_2_outlined, size: 18),
                  label: Text('Held ${ref.watch(heldSalesProvider).length}'),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                  ),
                ),
              if (_cart.isNotEmpty)
                IconButton(
                  onPressed: _holdCurrentSale,
                  icon: const Icon(Icons.pause_circle_outline_rounded),
                  tooltip: 'Hold sale',
                ),
              TextButton.icon(
                onPressed: _addCustomItem,
                icon: const Icon(Icons.add_circle_outline_rounded, size: 18),
                label: const Text('Custom'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
              ),
            ],
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
    required this.grossTotal,
    required this.discountAmount,
    required this.netTotal,
    required this.discountController,
    required this.isPercent,
    required this.onToggleType,
    required this.customerNameController,
    required this.customerPhoneController,
    required this.saleDate,
    required this.onPickDate,
    required this.onPickCustomer,
  });

  final List<PosCartItem> cart;
  final void Function(String id, int delta) onChangeQty;
  final GstCartSummary Function() gstSummary;
  final double Function() grossTotal;
  final double Function() discountAmount;
  final double Function() netTotal;
  final TextEditingController discountController;
  final bool Function() isPercent;
  final VoidCallback onToggleType;
  final TextEditingController customerNameController;
  final TextEditingController customerPhoneController;
  final DateTime? Function() saleDate;
  final Future<void> Function() onPickDate;
  final Future<void> Function() onPickCustomer;

  @override
  State<_CartSheet> createState() => _CartSheetState();
}

class _CartSheetState extends State<_CartSheet> {
  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final theme = Theme.of(context);
    final gst = widget.gstSummary();

    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      minChildSize: 0.4,
      maxChildSize: 0.95,
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
                    : ListView(
                        controller: scrollController,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                        children: <Widget>[
                          for (final line in widget.cart) ...<Widget>[
                            _CartLine(
                              line: line,
                              onInc: () {
                                widget.onChangeQty(line.id, 1);
                                setState(() {});
                              },
                              onDec: () {
                                widget.onChangeQty(line.id, -1);
                                setState(() {});
                              },
                            ),
                            const SizedBox(height: 10),
                          ],
                          _DiscountCard(
                            controller: widget.discountController,
                            isPercent: widget.isPercent(),
                            onToggle: () {
                              widget.onToggleType();
                              setState(() {});
                            },
                            onChanged: () => setState(() {}),
                          ),
                          const SizedBox(height: 10),
                          _CustomerCard(
                            nameController: widget.customerNameController,
                            phoneController: widget.customerPhoneController,
                            onPick: () async {
                              await widget.onPickCustomer();
                              setState(() {});
                            },
                          ),
                          const SizedBox(height: 10),
                          _DateCard(
                            date: widget.saleDate(),
                            onTap: () async {
                              await widget.onPickDate();
                              if (context.mounted) setState(() {});
                            },
                          ),
                        ],
                      ),
              ),
              _CartFooter(
                gst: gst,
                discount: widget.discountAmount(),
                total: widget.netTotal(),
                onPay: widget.cart.isEmpty
                    ? null
                    : () => Navigator.of(context).pop('checkout'),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _DiscountCard extends StatelessWidget {
  const _DiscountCard({
    required this.controller,
    required this.isPercent,
    required this.onToggle,
    required this.onChanged,
  });

  final TextEditingController controller;
  final bool isPercent;
  final VoidCallback onToggle;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.borderSoft),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        children: <Widget>[
          Icon(Icons.local_offer_rounded, size: 20, color: colors.textTertiary),
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (_) => onChanged(),
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'Discount',
                border: InputBorder.none,
              ),
            ),
          ),
          const SizedBox(width: 8),
          _MiniToggle(
            leftLabel: '₹',
            rightLabel: '%',
            rightSelected: isPercent,
            onTap: onToggle,
          ),
        ],
      ),
    );
  }
}

class _MiniToggle extends StatelessWidget {
  const _MiniToggle({
    required this.leftLabel,
    required this.rightLabel,
    required this.rightSelected,
    required this.onTap,
  });

  final String leftLabel;
  final String rightLabel;
  final bool rightSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: AppPalette.primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        padding: const EdgeInsets.all(3),
        child: Row(
          children: <Widget>[
            _MiniToggleChip(label: leftLabel, selected: !rightSelected),
            _MiniToggleChip(label: rightLabel, selected: rightSelected),
          ],
        ),
      ),
    );
  }
}

class _MiniToggleChip extends StatelessWidget {
  const _MiniToggleChip({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 34,
      height: 30,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: selected ? AppPalette.primary : Colors.transparent,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontWeight: FontWeight.w800,
          color: selected ? Colors.white : AppPalette.primary,
        ),
      ),
    );
  }
}

class _DateCard extends StatelessWidget {
  const _DateCard({required this.date, required this.onTap});

  final DateTime? date;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.borderSoft),
          ),
          child: Row(
            children: <Widget>[
              Icon(
                Icons.event_rounded,
                size: 20,
                color: colors.textTertiary,
              ),
              const SizedBox(width: 12),
              Text(
                'Sale date',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textSecondary,
                ),
              ),
              const Spacer(),
              Text(
                date == null ? 'Today' : formatCompactDate(date!),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 6),
              Icon(Icons.edit_calendar_rounded, size: 18, color: AppPalette.primary),
            ],
          ),
        ),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({
    required this.nameController,
    required this.phoneController,
    required this.onPick,
  });

  final TextEditingController nameController;
  final TextEditingController phoneController;
  final Future<void> Function() onPick;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: colors.borderSoft),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.person_rounded, size: 20, color: colors.textTertiary),
              const SizedBox(width: 8),
              Text(
                'Customer (optional)',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const Spacer(),
              TextButton.icon(
                onPressed: onPick,
                icon: const Icon(Icons.people_alt_rounded, size: 16),
                label: const Text('Choose'),
                style: TextButton.styleFrom(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  visualDensity: VisualDensity.compact,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          TextField(
            controller: nameController,
            textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(
              isDense: true,
              hintText: 'Name',
              border: InputBorder.none,
            ),
          ),
          TextField(
            controller: phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              isDense: true,
              hintText: 'Phone',
              border: InputBorder.none,
            ),
          ),
        ],
      ),
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
  const _CartFooter({
    required this.gst,
    required this.discount,
    required this.total,
    required this.onPay,
  });

  final GstCartSummary gst;
  final double discount;
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
          if (discount > 0) ...<Widget>[
            const SizedBox(height: 6),
            _SummaryRow(
              label: 'Discount',
              value: '- ${formatCurrency(discount)}',
              valueColor: AppPalette.success,
            ),
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
  const _SummaryRow({required this.label, required this.value, this.valueColor});

  final String label;
  final String value;
  final Color? valueColor;

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
          style: theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: valueColor,
          ),
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
