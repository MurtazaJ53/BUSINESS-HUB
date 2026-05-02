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

class DomainControlState {
  const DomainControlState({
    required this.domain,
    required this.currentEpoch,
    required this.cutoverStatus,
    required this.writeMaster,
    required this.controlPresent,
    required this.shadowReadsEnabled,
    required this.isEnabled,
    required this.canWriteOnPostgresSurface,
    this.pilotSignoffStatus,
    this.pilotSignoffSummary,
    this.pilotRecommendedAction,
    this.pilotLatestVerifyResult,
  });

  final String domain;
  final int currentEpoch;
  final String cutoverStatus;
  final String writeMaster;
  final bool controlPresent;
  final bool shadowReadsEnabled;
  final bool isEnabled;
  final bool canWriteOnPostgresSurface;
  final String? pilotSignoffStatus;
  final String? pilotSignoffSummary;
  final String? pilotRecommendedAction;
  final String? pilotLatestVerifyResult;

  bool get isPostgresPrimary =>
      cutoverStatus == 'postgres_primary' || writeMaster == 'postgres';

  bool get isPilotReady =>
      pilotSignoffStatus == 'ready_for_cutover' ||
      pilotSignoffStatus == 'production_safe';

  String get postureLabel {
    if (cutoverStatus == 'postgres_primary') {
      return 'Postgres primary';
    }
    if (cutoverStatus == 'ready') {
      return 'Pilot ready';
    }
    if (cutoverStatus == 'pilot') {
      return 'Pilot active';
    }
    return 'Legacy bridge';
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
    'domain': domain,
    'current_epoch': currentEpoch,
    'cutover_status': cutoverStatus,
    'write_master': writeMaster,
    'control_present': controlPresent,
    'shadow_reads_enabled': shadowReadsEnabled,
    'is_enabled': isEnabled,
    'can_write_on_postgres_surface': canWriteOnPostgresSurface,
    'pilot_signoff_status': pilotSignoffStatus,
    'pilot_signoff_summary': pilotSignoffSummary,
    'pilot_recommended_action': pilotRecommendedAction,
    'pilot_latest_verify_result': pilotLatestVerifyResult,
  };

  factory DomainControlState.fromJson(
    Map<String, dynamic> json, {
    String? fallbackDomain,
  }) {
    final epoch = json['current_epoch'];
    return DomainControlState(
      domain: (json['domain'] ?? fallbackDomain ?? 'unknown').toString(),
      currentEpoch: epoch is int
          ? epoch
          : epoch is num
          ? epoch.toInt()
          : int.tryParse('$epoch') ?? 1,
      cutoverStatus: (json['cutover_status'] ?? 'legacy').toString(),
      writeMaster: (json['write_master'] ?? 'firebase').toString(),
      controlPresent: json['control_present'] == true,
      shadowReadsEnabled: json['shadow_reads_enabled'] == true,
      isEnabled: json['is_enabled'] != false,
      canWriteOnPostgresSurface: json['can_write_on_postgres_surface'] == true,
      pilotSignoffStatus: _nullableText(json['pilot_signoff_status']),
      pilotSignoffSummary: _nullableText(json['pilot_signoff_summary']),
      pilotRecommendedAction: _nullableText(json['pilot_recommended_action']),
      pilotLatestVerifyResult: _nullableText(
        json['pilot_latest_verify_result'],
      ),
    );
  }

  factory DomainControlState.legacy(String domain) {
    return DomainControlState(
      domain: domain,
      currentEpoch: 1,
      cutoverStatus: 'legacy',
      writeMaster: 'firebase',
      controlPresent: false,
      shadowReadsEnabled: false,
      isEnabled: true,
      canWriteOnPostgresSurface: false,
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

class HistoryOverview {
  const HistoryOverview({
    required this.totalSales,
    required this.syncedSales,
    required this.queuedSales,
    required this.failedSales,
    required this.totalRevenue,
    required this.queuedRevenue,
    this.lastSyncedAt,
  });

  final int totalSales;
  final int syncedSales;
  final int queuedSales;
  final int failedSales;
  final double totalRevenue;
  final double queuedRevenue;
  final DateTime? lastSyncedAt;

  factory HistoryOverview.empty() {
    return const HistoryOverview(
      totalSales: 0,
      syncedSales: 0,
      queuedSales: 0,
      failedSales: 0,
      totalRevenue: 0,
      queuedRevenue: 0,
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

class CustomerPulseSummary {
  const CustomerPulseSummary({
    required this.name,
    required this.visitCount,
    required this.lifetimeSpend,
    required this.lastSeenAt,
    this.phone,
    this.pendingSales = 0,
  });

  final String name;
  final String? phone;
  final int visitCount;
  final double lifetimeSpend;
  final DateTime lastSeenAt;
  final int pendingSales;
}

class BackendCustomerSummary {
  const BackendCustomerSummary({
    required this.id,
    required this.name,
    required this.totalSpent,
    required this.balance,
    required this.status,
    this.phone,
    this.email,
    this.notes,
  });

  final String id;
  final String name;
  final String? phone;
  final String? email;
  final double totalSpent;
  final double balance;
  final String status;
  final String? notes;
}

class CustomerLedgerPreviewEntry {
  const CustomerLedgerPreviewEntry({
    required this.id,
    required this.eventType,
    required this.amountDelta,
    required this.occurredAt,
    this.note,
    this.actorName,
  });

  final String id;
  final String eventType;
  final double amountDelta;
  final DateTime occurredAt;
  final String? note;
  final String? actorName;
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

String? _nullableText(Object? value) {
  if (value == null) {
    return null;
  }
  final text = value.toString().trim();
  return text.isEmpty ? null : text;
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
