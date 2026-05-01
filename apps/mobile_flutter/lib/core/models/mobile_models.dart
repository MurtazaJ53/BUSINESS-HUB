class ShopInfo {
  const ShopInfo({
    required this.name,
    required this.tagline,
    required this.footer,
    required this.currency,
    required this.phone,
  });

  final String name;
  final String tagline;
  final String footer;
  final String currency;
  final String phone;

  factory ShopInfo.fallback() {
    return const ShopInfo(
      name: 'Business Hub Pro',
      tagline: 'ZARRA ECOSYSTEM',
      footer: 'Thank you for your business!',
      currency: 'INR',
      phone: '',
    );
  }
}

class InventoryMetrics {
  const InventoryMetrics({
    required this.totalItems,
    required this.totalStock,
    required this.inventoryValue,
    required this.potentialProfit,
    required this.lowStock,
  });

  final int totalItems;
  final int totalStock;
  final double inventoryValue;
  final double potentialProfit;
  final int lowStock;

  factory InventoryMetrics.empty() {
    return const InventoryMetrics(
      totalItems: 0,
      totalStock: 0,
      inventoryValue: 0,
      potentialProfit: 0,
      lowStock: 0,
    );
  }
}

class DashboardOverview {
  const DashboardOverview({
    required this.metrics,
    required this.todaySalesCount,
    required this.todayRevenue,
  });

  final InventoryMetrics metrics;
  final int todaySalesCount;
  final double todayRevenue;

  factory DashboardOverview.empty() {
    return DashboardOverview(
      metrics: InventoryMetrics.empty(),
      todaySalesCount: 0,
      todayRevenue: 0,
    );
  }
}

class InventoryCategorySummary {
  const InventoryCategorySummary({
    required this.category,
    required this.productCount,
  });

  final String category;
  final int productCount;
}

class InventoryCatalogItem {
  const InventoryCatalogItem({
    required this.id,
    required this.name,
    required this.price,
    required this.category,
    required this.stock,
    required this.createdAt,
    this.sku,
    this.subcategory,
    this.size,
    this.description,
    this.sourceMeta,
    this.costPrice,
  });

  final String id;
  final String name;
  final double price;
  final String category;
  final int stock;
  final DateTime createdAt;
  final String? sku;
  final String? subcategory;
  final String? size;
  final String? description;
  final String? sourceMeta;
  final double? costPrice;

  double get marginPerUnit => price - (costPrice ?? 0);
}

class LowStockItem {
  const LowStockItem({
    required this.id,
    required this.name,
    required this.category,
    required this.stock,
    this.size,
  });

  final String id;
  final String name;
  final String category;
  final int stock;
  final String? size;
}

class PosPayment {
  const PosPayment({required this.mode, required this.amount});

  final String mode;
  final double amount;

  Map<String, dynamic> toJson() => {'mode': mode, 'amount': amount};
}

enum CommerceCommandType { saleCreate, paymentCreate }

enum CommerceSyncState { localOnly, queued, syncing, synced, failed }

class CommerceSyncResult {
  const CommerceSyncResult({
    required this.commandId,
    required this.state,
    this.backendEntityId,
    this.message,
  });

  final String commandId;
  final CommerceSyncState state;
  final String? backendEntityId;
  final String? message;

  bool get acceptedByBackend => state == CommerceSyncState.synced;
}

class PosCartItem {
  const PosCartItem({
    required this.id,
    required this.name,
    required this.price,
    required this.quantity,
    required this.stock,
    required this.category,
    this.size,
    this.sku,
    this.costPrice,
  });

  final String id;
  final String name;
  final double price;
  final int quantity;
  final int stock;
  final String category;
  final String? size;
  final String? sku;
  final double? costPrice;

  double get lineTotal => price * quantity;

  PosCartItem copyWith({
    String? id,
    String? name,
    double? price,
    int? quantity,
    int? stock,
    String? category,
    String? size,
    String? sku,
    double? costPrice,
  }) {
    return PosCartItem(
      id: id ?? this.id,
      name: name ?? this.name,
      price: price ?? this.price,
      quantity: quantity ?? this.quantity,
      stock: stock ?? this.stock,
      category: category ?? this.category,
      size: size ?? this.size,
      sku: sku ?? this.sku,
      costPrice: costPrice ?? this.costPrice,
    );
  }

  Map<String, dynamic> toSaleJson() => {
    'itemId': id,
    'name': name,
    'quantity': quantity,
    'price': price,
    'size': size,
    'costPrice': costPrice,
  };
}

class RecentSaleSummary {
  const RecentSaleSummary({
    required this.id,
    required this.total,
    required this.date,
    required this.paymentMode,
    required this.syncState,
    this.customerName,
  });

  final String id;
  final double total;
  final String date;
  final String paymentMode;
  final CommerceSyncState syncState;
  final String? customerName;
}

class CommerceOutboxEntryModel {
  const CommerceOutboxEntryModel({
    required this.commandId,
    required this.shopId,
    required this.commandType,
    required this.domain,
    required this.baseDomainEpoch,
    required this.payloadJson,
    required this.syncStatus,
    required this.attemptCount,
    required this.createdAt,
    required this.updatedAt,
    this.lastAttemptAt,
    this.completedAt,
    this.lastError,
  });

  final String commandId;
  final String shopId;
  final String commandType;
  final String domain;
  final int baseDomainEpoch;
  final String payloadJson;
  final String syncStatus;
  final int attemptCount;
  final int createdAt;
  final int updatedAt;
  final int? lastAttemptAt;
  final int? completedAt;
  final String? lastError;
}

class LocalSaleCommit {
  const LocalSaleCommit({
    required this.commandId,
    required this.saleId,
    required this.shopId,
    required this.baseDomainEpoch,
    required this.date,
    required this.createdAt,
    required this.total,
    required this.discount,
    required this.discountType,
    required this.paymentMode,
    required this.items,
    required this.payments,
    required this.customerName,
    required this.customerPhone,
    required this.footerNote,
    required this.inventoryDeltas,
  });

  final String commandId;
  final String saleId;
  final String shopId;
  final int baseDomainEpoch;
  final String date;
  final String createdAt;
  final double total;
  final double discount;
  final String discountType;
  final String paymentMode;
  final List<Map<String, dynamic>> items;
  final List<Map<String, dynamic>> payments;
  final String? customerName;
  final String? customerPhone;
  final String? footerNote;
  final Map<String, int> inventoryDeltas;

  Map<String, dynamic> toBackendCommandPayload() => {
    'command_id': commandId,
    'base_domain_epoch': baseDomainEpoch,
    'source_surface': 'flutter_pos',
    'sale': {
      'customer_name': customerName ?? '',
      'customer_phone': customerPhone ?? '',
      'discount_amount': discount.toStringAsFixed(2),
      'payment_mode': paymentMode,
      'footer_note': footerNote ?? '',
      'sale_date': date,
      'occurred_at': createdAt,
      'items': items
          .map(
            (item) => {
              'inventory_item_id': item['itemId'],
              'name': item['name'],
              'sku': item['sku'] ?? '',
              'size': item['size'] ?? '',
              'quantity': item['quantity'],
              'unit_price': (item['price'] as num).toStringAsFixed(2),
              'unit_cost': item['costPrice'] == null
                  ? null
                  : (item['costPrice'] as num).toStringAsFixed(2),
            },
          )
          .toList(growable: false),
      'payments': payments
          .map(
            (payment) => {
              'payment_method': payment['mode'],
              'amount': (payment['amount'] as num).toStringAsFixed(2),
            },
          )
          .toList(growable: false),
    },
  };

  Map<String, dynamic> toFirestorePayload({String? staffId}) => {
    'id': saleId,
    'items': items,
    'total': total,
    'discount': discount,
    'discountValue': discount.toStringAsFixed(2),
    'discountType': discountType,
    'paymentMode': paymentMode,
    'payments': payments,
    'customerName': customerName ?? '',
    'customerPhone': customerPhone ?? '',
    'footerNote': footerNote ?? '',
    'date': date,
    'createdAt': createdAt,
    'staffId': staffId ?? '',
    'updatedAt': DateTime.now().millisecondsSinceEpoch,
  };
}
