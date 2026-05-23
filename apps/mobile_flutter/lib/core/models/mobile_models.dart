class ShopInfo {
  const ShopInfo({
    required this.name,
    required this.tagline,
    required this.footer,
    required this.currency,
    required this.phone,
    this.planTier = 'growth',
    this.enabledFeatures = const <String, bool>{},
  });

  final String name;
  final String tagline;
  final String footer;
  final String currency;
  final String phone;
  final String planTier;
  final Map<String, bool> enabledFeatures;

  String get normalizedPlanTier => _normalizePlanTier(planTier);
  String get planLabel {
    switch (normalizedPlanTier) {
      case 'starter':
        return 'Starter';
      case 'pro':
        return 'Pro';
      default:
        return 'Growth';
    }
  }

  bool get supportsExpenses =>
      enabledFeatures['expenses'] ?? normalizedPlanTier != 'starter';
  bool get supportsAttendance =>
      enabledFeatures['attendance'] ?? normalizedPlanTier != 'starter';
  bool get supportsAdvancedReports =>
      enabledFeatures['advanced_reports'] ?? normalizedPlanTier == 'pro';
  bool get supportsFinanceSummary =>
      enabledFeatures['finance_summary'] ?? normalizedPlanTier == 'pro';
  bool get supportsSupplierDirectory =>
      enabledFeatures['supplier_directory'] ?? normalizedPlanTier != 'starter';
  bool get supportsPurchaseWorkflow =>
      enabledFeatures['purchase_workflow'] ?? normalizedPlanTier == 'pro';
  bool get supportsAdvancedOps =>
      enabledFeatures['advanced_ops'] ?? normalizedPlanTier == 'pro';

  factory ShopInfo.fallback() {
    return const ShopInfo(
      name: 'Business Hub Pro',
      tagline: 'ZARRA ECOSYSTEM',
      footer: 'Thank you for your business!',
      currency: 'INR',
      phone: '',
      planTier: 'growth',
      enabledFeatures: <String, bool>{
        'expenses': true,
        'attendance': true,
        'advanced_reports': false,
        'finance_summary': false,
        'advanced_ops': false,
      },
    );
  }
}

class WorkspaceAccessSessionHeartbeatResult {
  const WorkspaceAccessSessionHeartbeatResult({
    required this.sessionId,
    required this.status,
    required this.deviceLabel,
    required this.shouldSignOut,
    required this.shouldWipeLocalData,
    this.revokeReason,
    this.revokedAt,
    this.wipeRequestedAt,
    this.wipeAcknowledgedAt,
  });

  final String sessionId;
  final String status;
  final String deviceLabel;
  final bool shouldSignOut;
  final bool shouldWipeLocalData;
  final String? revokeReason;
  final DateTime? revokedAt;
  final DateTime? wipeRequestedAt;
  final DateTime? wipeAcknowledgedAt;
}

class UserMfaStatus {
  const UserMfaStatus({
    required this.totpEnabled,
    required this.totpPendingEnrollment,
    required this.enabledAt,
    required this.lastVerifiedAt,
    required this.issuerLabel,
    required this.accountLabel,
    required this.challengeWindowSeconds,
    required this.pendingManualSecret,
    required this.pendingOtpauthUri,
  });

  final bool totpEnabled;
  final bool totpPendingEnrollment;
  final DateTime? enabledAt;
  final DateTime? lastVerifiedAt;
  final String issuerLabel;
  final String accountLabel;
  final int challengeWindowSeconds;
  final String pendingManualSecret;
  final String pendingOtpauthUri;
}

class UserMfaVerifyResult {
  const UserMfaVerifyResult({
    required this.status,
    required this.verifiedAt,
    required this.verifiedUntil,
  });

  final UserMfaStatus status;
  final DateTime verifiedAt;
  final DateTime verifiedUntil;
}

class WorkspacePulseHeadline {
  const WorkspacePulseHeadline({
    required this.title,
    required this.body,
    required this.route,
    required this.ctaLabel,
    required this.tone,
  });

  final String title;
  final String body;
  final String route;
  final String ctaLabel;
  final String tone;
}

class WorkspacePulseTask {
  const WorkspacePulseTask({
    required this.code,
    required this.priority,
    required this.tone,
    required this.title,
    required this.body,
    required this.route,
    required this.ctaLabel,
    required this.count,
    this.metadata = const <String, dynamic>{},
  });

  final String code;
  final String priority;
  final String tone;
  final String title;
  final String body;
  final String route;
  final String ctaLabel;
  final int count;
  final Map<String, dynamic> metadata;
}

class WorkspacePulseAnomaly {
  const WorkspacePulseAnomaly({
    required this.code,
    required this.severity,
    required this.title,
    required this.body,
    required this.route,
    required this.ctaLabel,
    required this.metricValue,
    this.metadata = const <String, dynamic>{},
  });

  final String code;
  final String severity;
  final String title;
  final String body;
  final String route;
  final String ctaLabel;
  final String metricValue;
  final Map<String, dynamic> metadata;
}

class WorkspacePulseStats {
  const WorkspacePulseStats({
    required this.openTaskCount,
    required this.criticalAnomalyCount,
    required this.warningAnomalyCount,
    required this.staleSessionCount,
    required this.wipePendingCount,
    required this.openPlanRequestCount,
    required this.lowStockCount,
  });

  final int openTaskCount;
  final int criticalAnomalyCount;
  final int warningAnomalyCount;
  final int staleSessionCount;
  final int wipePendingCount;
  final int openPlanRequestCount;
  final int lowStockCount;
}

class WorkspacePulseSnapshot {
  const WorkspacePulseSnapshot({
    required this.refreshedAt,
    required this.headline,
    required this.stats,
    required this.tasks,
    required this.anomalies,
  });

  final DateTime refreshedAt;
  final WorkspacePulseHeadline headline;
  final WorkspacePulseStats stats;
  final List<WorkspacePulseTask> tasks;
  final List<WorkspacePulseAnomaly> anomalies;
}

class WorkspacePulseSignal {
  const WorkspacePulseSignal({
    required this.id,
    required this.signalKind,
    required this.code,
    required this.status,
    required this.signalLevel,
    required this.signalRank,
    required this.tone,
    required this.title,
    required this.body,
    required this.route,
    required this.ctaLabel,
    required this.metricValue,
    required this.count,
    required this.firstDetectedAt,
    required this.lastDetectedAt,
    required this.lastSnapshotRefreshedAt,
    required this.acknowledgedAt,
    required this.acknowledgedByName,
    required this.resolvedAt,
    required this.resolvedByName,
    required this.resolutionNote,
    this.metadata = const <String, dynamic>{},
  });

  final String id;
  final String signalKind;
  final String code;
  final String status;
  final String signalLevel;
  final int signalRank;
  final String tone;
  final String title;
  final String body;
  final String route;
  final String ctaLabel;
  final String metricValue;
  final int count;
  final DateTime firstDetectedAt;
  final DateTime lastDetectedAt;
  final DateTime lastSnapshotRefreshedAt;
  final DateTime? acknowledgedAt;
  final String? acknowledgedByName;
  final DateTime? resolvedAt;
  final String? resolvedByName;
  final String resolutionNote;
  final Map<String, dynamic> metadata;

  bool get isResolved => status == 'resolved';
  bool get isAcknowledged => status == 'acknowledged';
  bool get isOpen => status == 'open';
}

String _normalizePlanTier(String value) {
  final normalized = value.trim().toLowerCase();
  if (normalized == 'starter' || normalized == 'pro') {
    return normalized;
  }
  return 'growth';
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

enum HistoryDateWindow {
  all('All time'),
  today('Today'),
  sevenDays('7 days'),
  thirtyDays('30 days'),
  ninetyDays('90 days');

  const HistoryDateWindow(this.label);

  final String label;
}

class HistoryFilter {
  const HistoryFilter({
    this.search = '',
    this.syncState,
    this.paymentMode,
    this.dateWindow = HistoryDateWindow.all,
    this.onlyDueSales = false,
    this.limit = 100,
  });

  final String search;
  final CommerceSyncState? syncState;
  final String? paymentMode;
  final HistoryDateWindow dateWindow;
  final bool onlyDueSales;
  final int limit;

  HistoryFilter copyWith({
    String? search,
    CommerceSyncState? syncState,
    String? paymentMode,
    HistoryDateWindow? dateWindow,
    bool? onlyDueSales,
    int? limit,
    bool clearSyncState = false,
    bool clearPaymentMode = false,
  }) {
    return HistoryFilter(
      search: search ?? this.search,
      syncState: clearSyncState ? null : (syncState ?? this.syncState),
      paymentMode: clearPaymentMode ? null : (paymentMode ?? this.paymentMode),
      dateWindow: dateWindow ?? this.dateWindow,
      onlyDueSales: onlyDueSales ?? this.onlyDueSales,
      limit: limit ?? this.limit,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is HistoryFilter &&
        other.search == search &&
        other.syncState == syncState &&
        other.paymentMode == paymentMode &&
        other.dateWindow == dateWindow &&
        other.onlyDueSales == onlyDueSales &&
        other.limit == limit;
  }

  @override
  int get hashCode => Object.hash(
    search,
    syncState,
    paymentMode,
    dateWindow,
    onlyDueSales,
    limit,
  );
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
    this.supplierId,
    this.lastPurchaseDate,
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
  final String? supplierId;
  final String? lastPurchaseDate;

  double get marginPerUnit => price - (costPrice ?? 0);
}

class PosCatalogFilter {
  const PosCatalogFilter({
    this.search = '',
    this.category,
    this.page = 1,
    this.pageSize = 40,
    this.includeCost = false,
    this.lowStockOnly = false,
  });

  final String search;
  final String? category;
  final int page;
  final int pageSize;
  final bool includeCost;
  final bool lowStockOnly;

  PosCatalogFilter copyWith({
    String? search,
    String? category,
    int? page,
    int? pageSize,
    bool? includeCost,
    bool? lowStockOnly,
    bool clearCategory = false,
  }) {
    return PosCatalogFilter(
      search: search ?? this.search,
      category: clearCategory ? null : (category ?? this.category),
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      includeCost: includeCost ?? this.includeCost,
      lowStockOnly: lowStockOnly ?? this.lowStockOnly,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is PosCatalogFilter &&
        other.search == search &&
        other.category == category &&
        other.page == page &&
        other.pageSize == pageSize &&
        other.includeCost == includeCost &&
        other.lowStockOnly == lowStockOnly;
  }

  @override
  int get hashCode =>
      Object.hash(search, category, page, pageSize, includeCost, lowStockOnly);
}

class InventoryCatalogFilter {
  const InventoryCatalogFilter({
    this.search = '',
    this.category,
    this.page = 1,
    this.pageSize = 40,
    this.includeCost = false,
    this.lowStockOnly = false,
  });

  final String search;
  final String? category;
  final int page;
  final int pageSize;
  final bool includeCost;
  final bool lowStockOnly;

  InventoryCatalogFilter copyWith({
    String? search,
    String? category,
    int? page,
    int? pageSize,
    bool? includeCost,
    bool? lowStockOnly,
    bool clearCategory = false,
  }) {
    return InventoryCatalogFilter(
      search: search ?? this.search,
      category: clearCategory ? null : (category ?? this.category),
      page: page ?? this.page,
      pageSize: pageSize ?? this.pageSize,
      includeCost: includeCost ?? this.includeCost,
      lowStockOnly: lowStockOnly ?? this.lowStockOnly,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is InventoryCatalogFilter &&
        other.search == search &&
        other.category == category &&
        other.page == page &&
        other.pageSize == pageSize &&
        other.includeCost == includeCost &&
        other.lowStockOnly == lowStockOnly;
  }

  @override
  int get hashCode =>
      Object.hash(search, category, page, pageSize, includeCost, lowStockOnly);
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
    required this.amountReceived,
    required this.amountDue,
    required this.date,
    required this.paymentMode,
    required this.syncState,
    this.customerName,
  });

  final String id;
  final double total;
  final double amountReceived;
  final double amountDue;
  final String date;
  final String paymentMode;
  final CommerceSyncState syncState;
  final String? customerName;

  bool get hasOutstandingDue => amountDue > 0.009;
}

class SaleDetailItem {
  const SaleDetailItem({
    required this.name,
    required this.quantity,
    required this.unitPrice,
    this.size,
    this.sku,
    this.unitCost,
  });

  final String name;
  final int quantity;
  final double unitPrice;
  final String? size;
  final String? sku;
  final double? unitCost;

  double get lineTotal => unitPrice * quantity;
}

class SaleDetailPayment {
  const SaleDetailPayment({
    required this.mode,
    required this.amount,
    this.referenceCode,
    this.note,
  });

  final String mode;
  final double amount;
  final String? referenceCode;
  final String? note;
}

class SaleRecordDetail {
  const SaleRecordDetail({
    required this.id,
    required this.total,
    required this.discount,
    required this.discountType,
    required this.paymentMode,
    required this.date,
    required this.syncState,
    required this.items,
    required this.payments,
    this.customerName,
    this.customerPhone,
    this.footerNote,
    this.commandId,
    this.backendSaleId,
    this.lastSyncError,
  });

  final String id;
  final double total;
  final double discount;
  final String discountType;
  final String paymentMode;
  final String date;
  final CommerceSyncState syncState;
  final List<SaleDetailItem> items;
  final List<SaleDetailPayment> payments;
  final String? customerName;
  final String? customerPhone;
  final String? footerNote;
  final String? commandId;
  final String? backendSaleId;
  final String? lastSyncError;

  int get itemCount => items.fold<int>(0, (sum, item) => sum + item.quantity);

  double get subtotal =>
      items.fold<double>(0, (sum, item) => sum + item.lineTotal);

  double get amountReceived =>
      payments.fold<double>(0, (sum, payment) => sum + payment.amount);

  double get amountDue {
    final due = total - amountReceived;
    return due > 0 ? due : 0;
  }

  bool get hasOutstandingDue => amountDue > 0.009;
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

class CommerceOutboxAttentionEntry {
  const CommerceOutboxAttentionEntry({
    required this.commandId,
    required this.commandType,
    required this.syncStatus,
    required this.attemptCount,
    required this.updatedAt,
    this.lastAttemptAt,
    this.lastError,
    this.saleId,
    this.customerName,
    this.total = 0,
    this.saleDate,
  });

  final String commandId;
  final String commandType;
  final String syncStatus;
  final int attemptCount;
  final int updatedAt;
  final int? lastAttemptAt;
  final String? lastError;
  final String? saleId;
  final String? customerName;
  final double total;
  final String? saleDate;

  bool get isFailed => syncStatus == 'failed';
  bool get isQueued => syncStatus == 'pending';
  bool get isSyncing => syncStatus == 'syncing';

  String get statusLabel {
    switch (syncStatus) {
      case 'failed':
        return 'FAILED';
      case 'syncing':
        return 'SYNCING';
      case 'pending':
        return 'QUEUED';
      default:
        return syncStatus.toUpperCase();
    }
  }

  String get commandLabel {
    switch (commandType) {
      case 'sale_create':
        return 'Sale replay';
      case 'payment_create':
        return 'Payment replay';
      default:
        return commandType;
    }
  }
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
    required this.customerId,
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
  final String? customerId;
  final String? customerName;
  final String? customerPhone;
  final String? footerNote;
  final Map<String, int> inventoryDeltas;

  Map<String, dynamic> toBackendCommandPayload() => {
    'command_id': commandId,
    'base_domain_epoch': baseDomainEpoch,
    'source_surface': 'flutter_pos',
    'sale': {
      'customer_id': customerId,
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
    'customerId': customerId,
    'customerName': customerName ?? '',
    'customerPhone': customerPhone ?? '',
    'footerNote': footerNote ?? '',
    'date': date,
    'createdAt': createdAt,
    'staffId': staffId ?? '',
    'updatedAt': DateTime.now().millisecondsSinceEpoch,
  };
}

class CustomerLedgerMutationDraft {
  CustomerLedgerMutationDraft({
    required this.eventType,
    required this.amountDelta,
    this.totalSpentDelta = 0,
    this.note,
    DateTime? occurredAt,
  }) : occurredAt = occurredAt ?? DateTime.now();

  final String eventType;
  final double amountDelta;
  final double totalSpentDelta;
  final String? note;
  final DateTime occurredAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
    'event_type': eventType,
    'amount_delta': amountDelta.toStringAsFixed(2),
    'total_spent_delta': totalSpentDelta.toStringAsFixed(2),
    'note': note ?? '',
    'occurred_at': occurredAt.toIso8601String(),
  };
}
