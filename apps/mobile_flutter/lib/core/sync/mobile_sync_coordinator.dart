import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../backend/backend_api_client.dart';
import '../database/mobile_repository.dart';
import '../models/mobile_models.dart';
import '../models/mobile_session.dart';
import '../runtime/app_runtime_info.dart';
import '../runtime/mobile_runtime_config.dart';
import '../session/mobile_session_controller.dart';

final syncStatusProvider =
    NotifierProvider<SyncStatusNotifier, MobileSyncStatus>(
      SyncStatusNotifier.new,
    );

class SyncStatusNotifier extends Notifier<MobileSyncStatus> {
  @override
  MobileSyncStatus build() => MobileSyncStatus.idle;

  void setStatus(MobileSyncStatus next) {
    if (state == next) {
      return;
    }
    state = next;
  }
}

final mobileSyncCoordinatorProvider = Provider<MobileSyncCoordinator>((ref) {
  final coordinator = MobileSyncCoordinator(
    backendApiClient: ref.read(backendApiClientProvider),
    shopRepository: ref.read(shopRepositoryProvider),
    inventoryRepository: ref.read(inventoryRepositoryProvider),
    customerRepository: ref.read(customerRepositoryProvider),
    salesRepository: ref.read(salesRepositoryProvider),
    setStatus: ref.read(syncStatusProvider.notifier).setStatus,
  );

  ref.listen<AsyncValue<MobileSession?>>(
    mobileSessionProvider,
    (_, next) => coordinator.handleSession(next.asData?.value),
    fireImmediately: true,
  );

  ref.onDispose(coordinator.dispose);
  return coordinator;
});

enum MobileSyncStatus { idle, syncing, offline, error }

class MobileSyncCoordinator {
  MobileSyncCoordinator({
    required BackendApiClient backendApiClient,
    required ShopRepository shopRepository,
    required InventoryRepository inventoryRepository,
    required CustomerRepository customerRepository,
    required SalesRepository salesRepository,
    required this.setStatus,
  }) : _backendApiClient = backendApiClient,
       _shopRepository = shopRepository,
       _inventoryRepository = inventoryRepository,
       _customerRepository = customerRepository,
       _salesRepository = salesRepository;

  final BackendApiClient _backendApiClient;
  final ShopRepository _shopRepository;
  final InventoryRepository _inventoryRepository;
  final CustomerRepository _customerRepository;
  final SalesRepository _salesRepository;
  final void Function(MobileSyncStatus status) setStatus;

  MobileSession? _session;
  bool _inventoryReadsUseBackend = false;
  bool _salesReadsUseBackend = false;
  bool _isFlushingOutbox = false;
  Timer? _outboxRetryTimer;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  Future<AppRuntimeInfo>? _runtimeInfoFuture;

  Future<void> handleSession(
    MobileSession? session, {
    bool force = false,
  }) async {
    final previousShopId = _session?.shopId;
    if (!force &&
        session?.shopId == _session?.shopId &&
        session?.role == _session?.role) {
      return;
    }

    await _cancelSubscriptions();

    final isSigningOut = session == null;
    final isSwitchingWorkspace =
        previousShopId != null &&
        session != null &&
        previousShopId != session.shopId;

    if (isSigningOut || isSwitchingWorkspace) {
      await _clearWorkspaceCache(clearSales: true);
    }

    _session = session;

    if (session == null || !session.hasShop) {
      _salesReadsUseBackend = false;
      setStatus(MobileSyncStatus.idle);
      return;
    }

    setStatus(MobileSyncStatus.syncing);
    final shopId = session.shopId!;
    await _ensureLocalWorkspace(session, shopId);
    if (!MobileRuntimeConfig.backendSyncEnabled) {
      _inventoryReadsUseBackend = false;
      _salesReadsUseBackend = false;
      setStatus(MobileSyncStatus.idle);
      return;
    }

    final hasAccess = await _syncWorkspaceAccessSession(session);
    if (!hasAccess) {
      return;
    }
    final domainStates = await _refreshBackendDomainEpochs(session, shopId);
    final inventoryState = domainStates['inventory'];
    final salesState = domainStates['sales'];
    _inventoryReadsUseBackend = inventoryState?.isPostgresPrimary ?? false;
    _salesReadsUseBackend = salesState?.isPostgresPrimary ?? false;

    if (_inventoryReadsUseBackend) {
      await _syncBackendInventorySnapshot(session, shopId);
    }

    if (_salesReadsUseBackend) {
      await _syncBackendSalesSnapshot(session, shopId);
    }

    setStatus(MobileSyncStatus.idle);
    _startOutboxRetryLoop();
    await flushCommerceOutbox(checkAccess: false);
  }

  Future<void> refresh() => handleSession(_session, force: true);

  Future<void> updateWorkspaceSettings({
    required ShopInfo currentShop,
    required String tagline,
    required String footer,
    required String phone,
  }) async {
    final session = _session;
    if (session == null || !session.hasShop) {
      throw StateError(
        'No active workspace is attached to this mobile session.',
      );
    }
    if (!session.isOwnerLike) {
      throw StateError(
        'Only workspace owners and admins can change mobile workspace settings.',
      );
    }

    setStatus(MobileSyncStatus.syncing);
    final payload = <String, dynamic>{
      'name': currentShop.name,
      'tagline': tagline,
      'footer': footer,
      'phone': phone,
      'currency': currentShop.currency,
      'plan_tier': currentShop.planTier,
      'enabled_features': currentShop.enabledFeatures,
      'settings': <String, dynamic>{
        'name': currentShop.name,
        'tagline': tagline,
        'footer': footer,
        'phone': phone,
        'currency': currentShop.currency,
        'plan_tier': currentShop.planTier,
        'enabled_features': currentShop.enabledFeatures,
      },
    };

    try {
      await _shopRepository.saveShopDocument(payload);
      setStatus(MobileSyncStatus.idle);
    } catch (error) {
      debugPrint('Workspace settings update failed: $error');
      setStatus(MobileSyncStatus.error);
      rethrow;
    }
  }

  Future<void> createInventoryItem({
    required String name,
    required double sellPrice,
    required int openingStock,
    String sku = '',
    String barcode = '',
    String category = 'General',
    String subcategory = '',
    String size = '',
    String description = '',
    double? costPrice,
    String hsnCode = '',
    double gstRate = 0,
    bool priceIncludesTax = true,
    String? imagePath,
  }) async {
    final session = _session;
    if (session == null || !session.hasShop) {
      throw StateError('Sign in to a workspace before adding inventory.');
    }
    if (session.isReadOnly) {
      throw StateError('Viewer access cannot add inventory items.');
    }

    setStatus(MobileSyncStatus.syncing);
    final now = DateTime.now();
    final updatedAt = now.millisecondsSinceEpoch;
    final normalizedCategory = category.trim().isEmpty
        ? 'General'
        : category.trim();

    if (!MobileRuntimeConfig.backendSyncEnabled) {
      await _createInventoryItemLocally(
        session: session,
        name: name.trim(),
        sellPrice: sellPrice,
        openingStock: openingStock,
        sku: sku.trim(),
        barcode: barcode.trim(),
        category: normalizedCategory,
        subcategory: subcategory.trim(),
        size: size.trim(),
        description: description.trim(),
        costPrice: session.canViewCost ? costPrice : null,
        hsnCode: hsnCode.trim(),
        gstRate: gstRate,
        priceIncludesTax: priceIncludesTax,
        imagePath: imagePath,
        timestamp: now,
      );
      setStatus(MobileSyncStatus.idle);
      return;
    }

    try {
      final created = await _backendApiClient.createInventoryItem(
        user: session.user,
        shopId: session.shopId!,
        name: name.trim(),
        sellPrice: sellPrice,
        openingStock: openingStock,
        sku: sku.trim(),
        barcode: barcode.trim(),
        category: normalizedCategory,
        subcategory: subcategory.trim(),
        size: size.trim(),
        description: description.trim(),
        costPrice: session.canViewCost ? costPrice : null,
        hsnCode: hsnCode.trim(),
        gstRate: gstRate,
        priceIncludesTax: priceIncludesTax,
      );
      await _inventoryRepository.mergeBackendInventoryItem(
        created,
        updatedAt: updatedAt,
      );
      // The backend has no image field yet, so keep the photo local-only by
      // re-merging it onto the freshly synced row.
      final createdId = created['id']?.toString();
      if (imagePath != null && createdId != null && createdId.isNotEmpty) {
        await _inventoryRepository.mergeInventoryDocument(
          createdId,
          <String, dynamic>{'imagePath': imagePath},
          updatedAt: updatedAt,
        );
      }
      setStatus(MobileSyncStatus.idle);
    } on BackendApiException catch (error) {
      final canUseLocalFallback =
          error.statusCode == null || error.statusCode == 409;
      if (!canUseLocalFallback) {
        setStatus(MobileSyncStatus.error);
        rethrow;
      }
      await _createInventoryItemLocally(
        session: session,
        name: name.trim(),
        sellPrice: sellPrice,
        openingStock: openingStock,
        sku: sku.trim(),
        barcode: barcode.trim(),
        category: normalizedCategory,
        subcategory: subcategory.trim(),
        size: size.trim(),
        description: description.trim(),
        costPrice: session.canViewCost ? costPrice : null,
        hsnCode: hsnCode.trim(),
        gstRate: gstRate,
        priceIncludesTax: priceIncludesTax,
        imagePath: imagePath,
        timestamp: now,
      );
      setStatus(MobileSyncStatus.idle);
    } on IOException catch (error) {
      debugPrint('Inventory backend unavailable, using local fallback: $error');
      await _createInventoryItemLocally(
        session: session,
        name: name.trim(),
        sellPrice: sellPrice,
        openingStock: openingStock,
        sku: sku.trim(),
        barcode: barcode.trim(),
        category: normalizedCategory,
        subcategory: subcategory.trim(),
        size: size.trim(),
        description: description.trim(),
        costPrice: session.canViewCost ? costPrice : null,
        hsnCode: hsnCode.trim(),
        gstRate: gstRate,
        priceIncludesTax: priceIncludesTax,
        imagePath: imagePath,
        timestamp: now,
      );
      setStatus(MobileSyncStatus.idle);
    } catch (_) {
      setStatus(MobileSyncStatus.error);
      rethrow;
    }
  }

  /// Update an existing inventory item locally (edit + restock).
  ///
  /// The local merge is a full upsert, so callers must pass the complete set
  /// of fields (using the item's current values for anything unchanged) or the
  /// missing fields reset to defaults.
  Future<void> updateInventoryItem({
    required String itemId,
    required String name,
    required double sellPrice,
    required int stock,
    String sku = '',
    String barcode = '',
    String category = 'General',
    String subcategory = '',
    String size = '',
    String description = '',
    double? costPrice,
    String hsnCode = '',
    double gstRate = 0,
    bool priceIncludesTax = true,
    DateTime? createdAt,
    String? imagePath,
  }) async {
    final session = _session;
    if (session == null || !session.hasShop) {
      throw StateError('Sign in to a workspace before editing inventory.');
    }
    if (session.isReadOnly) {
      throw StateError('Viewer access cannot edit inventory items.');
    }

    setStatus(MobileSyncStatus.syncing);
    final now = DateTime.now();
    final iso = now.toIso8601String();
    final normalizedCategory =
        category.trim().isEmpty ? 'General' : category.trim();
    final payload = <String, dynamic>{
      'name': name.trim(),
      'price': sellPrice,
      'sell_price': sellPrice,
      'sku': sku.trim(),
      'barcode': barcode.trim(),
      'category': normalizedCategory,
      'subcategory': subcategory.trim(),
      'size': size.trim(),
      'description': description.trim(),
      'hsnCode': hsnCode.trim(),
      'gstRate': gstRate,
      'priceIncludesTax': priceIncludesTax,
      'stock': stock,
      'status': 'active',
      'tombstone': false,
      // Always present on edit so the form fully owns the photo (set / replace
      // / remove); null clears it.
      'imagePath': imagePath,
      'createdAt': (createdAt ?? now).toIso8601String(),
      'updatedAt': iso,
    };
    await _inventoryRepository.mergeInventoryDocument(
      itemId,
      payload,
      updatedAt: now.millisecondsSinceEpoch,
    );
    if (costPrice != null && session.canViewCost) {
      await _inventoryRepository.mergeInventoryPrivateDocument(
        itemId,
        <String, dynamic>{
          'costPrice': costPrice,
          'updatedAt': iso,
          'tombstone': false,
        },
        updatedAt: now.millisecondsSinceEpoch,
      );
    }
    setStatus(MobileSyncStatus.idle);
  }

  /// Archive (soft-delete) an inventory item locally. Tombstoned items are
  /// filtered out of every catalog query.
  Future<void> deleteInventoryItem({
    required String itemId,
    required String name,
  }) async {
    final session = _session;
    if (session == null || !session.hasShop) {
      throw StateError('Sign in to a workspace before removing inventory.');
    }
    if (session.isReadOnly) {
      throw StateError('Viewer access cannot remove inventory items.');
    }
    setStatus(MobileSyncStatus.syncing);
    final now = DateTime.now();
    await _inventoryRepository.mergeInventoryDocument(
      itemId,
      <String, dynamic>{
        'name': name,
        'status': 'archived',
        'tombstone': true,
        'updatedAt': now.toIso8601String(),
      },
      updatedAt: now.millisecondsSinceEpoch,
    );
    setStatus(MobileSyncStatus.idle);
  }

  /// Pull the latest inventory + customers from the backend and merge them
  /// locally. Merges are upserts, so a pull can never lose local data. Paired
  /// with the outbox push this gives two-way, multi-device sync.
  Future<CommerceSyncResult> pullFromCloud() async {
    if (!MobileRuntimeConfig.backendSyncEnabled) {
      return const CommerceSyncResult(
        commandId: 'pull',
        state: CommerceSyncState.queued,
        message: 'Live backend sync is disabled for this build.',
      );
    }
    final session = _session;
    if (session == null || !session.hasShop) {
      return const CommerceSyncResult(
        commandId: 'pull',
        state: CommerceSyncState.queued,
        message: 'Sign in to a workspace before syncing.',
      );
    }

    setStatus(MobileSyncStatus.syncing);
    final now = DateTime.now().millisecondsSinceEpoch;
    try {
      final shopId = session.shopId!;
      final user = session.user;

      final items = await _backendApiClient.fetchInventoryItems(
        user: user,
        shopId: shopId,
      );
      for (final row in items) {
        await _inventoryRepository.mergeBackendInventoryItem(
          row,
          updatedAt: now,
        );
      }

      final customers = await _backendApiClient.fetchCustomers(
        user: user,
        shopId: shopId,
      );
      final iso = DateTime.now().toIso8601String();
      for (final c in customers) {
        await _customerRepository.mergeRemoteCustomerDocument(
          c.id,
          <String, dynamic>{
            'name': c.name,
            'phone': c.phone ?? '',
            'email': c.email ?? '',
            'notes': c.notes ?? '',
            'status': c.status,
            'balance': c.balance,
            'total_spent': c.totalSpent,
            'tombstone': false,
            'updatedAt': iso,
          },
          updatedAt: now,
        );
      }

      setStatus(MobileSyncStatus.idle);
      return CommerceSyncResult(
        commandId: 'pull',
        state: CommerceSyncState.synced,
        message:
            'Pulled ${items.length} products and ${customers.length} customers.',
      );
    } on BackendApiException catch (error) {
      setStatus(MobileSyncStatus.error);
      return CommerceSyncResult(
        commandId: 'pull',
        state: CommerceSyncState.failed,
        message: 'Cloud pull failed: ${error.message}',
      );
    } on IOException catch (error) {
      setStatus(MobileSyncStatus.offline);
      return CommerceSyncResult(
        commandId: 'pull',
        state: CommerceSyncState.failed,
        message: 'Cloud unreachable: $error',
      );
    }
  }

  /// Full two-way sync: push queued sales/payments, then pull the latest
  /// catalog + customers. Safe to trigger manually.
  Future<CommerceSyncResult> syncNow() async {
    final push = await flushCommerceOutbox();
    final pull = await pullFromCloud();
    if (pull.state == CommerceSyncState.failed) return pull;
    return CommerceSyncResult(
      commandId: 'sync-now',
      state: pull.state,
      message: 'Synced. ${pull.message} ${push.message ?? ''}'.trim(),
    );
  }

  Future<CommerceSyncResult> submitSale(LocalSaleCommit commit) async {
    final session = _session;
    if (session == null || !session.hasShop) {
      return CommerceSyncResult(
        commandId: commit.commandId,
        state: CommerceSyncState.queued,
        message: 'Sale saved locally. Sign in again to sync it.',
      );
    }

    return flushCommerceOutbox(triggerCommandId: commit.commandId);
  }

  Future<void> dispose() => _cancelSubscriptions();

  Future<CommerceSyncResult> retryCommerceCommand(String commandId) async {
    await _salesRepository.markCommandQueued(commandId);
    return flushCommerceOutbox(triggerCommandId: commandId);
  }

  Future<CommerceSyncResult> flushCommerceOutbox({
    String? triggerCommandId,
    bool checkAccess = true,
  }) async {
    if (!MobileRuntimeConfig.backendSyncEnabled) {
      return CommerceSyncResult(
        commandId: triggerCommandId ?? 'local-only',
        state: CommerceSyncState.queued,
        message:
            'Sale saved locally. Live backend sync is disabled for this build.',
      );
    }

    if (_isFlushingOutbox) {
      return CommerceSyncResult(
        commandId: triggerCommandId ?? 'pending',
        state: CommerceSyncState.syncing,
        message: 'Commerce outbox sync is already in progress.',
      );
    }

    final session = _session;
    if (session == null || !session.hasShop) {
      return CommerceSyncResult(
        commandId: triggerCommandId ?? 'unknown',
        state: CommerceSyncState.queued,
        message: 'Outbox is waiting for an authenticated workspace.',
      );
    }

    if (checkAccess) {
      final hasAccess = await _syncWorkspaceAccessSession(session);
      if (!hasAccess) {
        return CommerceSyncResult(
          commandId: triggerCommandId ?? 'unknown',
          state: CommerceSyncState.queued,
          message:
              'Workspace access ended on this device. Sign in again if access is restored.',
        );
      }
    }

    _isFlushingOutbox = true;
    final entries = await _salesRepository.getPendingOutboxEntries();
    if (entries.isEmpty) {
      _isFlushingOutbox = false;
      return CommerceSyncResult(
        commandId: triggerCommandId ?? 'none',
        state: CommerceSyncState.synced,
        message: 'Nothing is waiting in the mobile outbox.',
      );
    }

    final foregroundSync = triggerCommandId != null;
    if (foregroundSync) {
      setStatus(MobileSyncStatus.syncing);
    }
    CommerceSyncResult? targetResult;
    var hadFailure = false;

    try {
      for (final entry in entries) {
        await _salesRepository.registerOutboxAttempt(entry.commandId);
        await _salesRepository.markOutboxSyncing(entry.commandId);
        try {
          final payload = Map<String, dynamic>.from(
            jsonDecode(entry.payloadJson) as Map<String, dynamic>,
          );
          late BackendCommandResponse response;
          switch (entry.commandType) {
            case 'sale_create':
              response = await _backendApiClient.submitSaleCommand(
                user: session.user,
                shopId: entry.shopId,
                payload: payload,
              );
              break;
            case 'payment_create':
              response = await _backendApiClient.submitPaymentCommand(
                user: session.user,
                shopId: entry.shopId,
                payload: payload,
              );
              break;
            default:
              throw BackendApiException(
                'Unknown mobile commerce command type: ${entry.commandType}',
              );
          }

          await _salesRepository.markCommandSynced(
            commandId: entry.commandId,
            receiptId: response.receiptId,
            backendSaleId: entry.commandType == 'sale_create'
                ? response.entityId
                : null,
          );
          if (entry.commandId == triggerCommandId) {
            targetResult = CommerceSyncResult(
              commandId: entry.commandId,
              state: CommerceSyncState.synced,
              backendEntityId: response.entityId,
              message: response.duplicate
                  ? 'Sale was already accepted by the backend earlier.'
                  : 'Sale saved locally and synced to the backend.',
            );
          }
        } catch (error) {
          debugPrint('Commerce outbox sync failed: $error');
          hadFailure = true;
          await _salesRepository.markCommandFailed(
            commandId: entry.commandId,
            error: error.toString(),
          );
          if (entry.commandId == triggerCommandId) {
            targetResult = CommerceSyncResult(
              commandId: entry.commandId,
              state: CommerceSyncState.queued,
              message:
                  'Sale saved locally. Backend sync is pending and will retry later.',
            );
          }
        }
      }

      if (_salesReadsUseBackend) {
        await _syncBackendSalesSnapshot(
          session,
          session.shopId!,
          updateStatus: foregroundSync,
        );
      }

      if (foregroundSync) {
        setStatus(hadFailure ? MobileSyncStatus.error : MobileSyncStatus.idle);
      }
      return targetResult ??
          CommerceSyncResult(
            commandId: triggerCommandId ?? entries.first.commandId,
            state: hadFailure
                ? CommerceSyncState.queued
                : CommerceSyncState.synced,
            message: hadFailure
                ? 'Some commerce commands are still queued for retry.'
                : 'Pending commerce commands were flushed.',
          );
    } finally {
      _isFlushingOutbox = false;
    }
  }

  Future<void> _clearWorkspaceCache({required bool clearSales}) async {
    final futures = <Future<void>>[
      _shopRepository.clearWorkspace(),
      _inventoryRepository.clearWorkspace(),
      _customerRepository.clearWorkspace(),
    ];
    if (clearSales) {
      futures.add(_salesRepository.clearWorkspace());
    }
    await Future.wait<void>(futures);
  }

  Future<void> _ensureLocalWorkspace(
    MobileSession session,
    String shopId,
  ) async {
    await _shopRepository.saveShopDocument(<String, dynamic>{
      'name': MobileRuntimeConfig.localShopName,
      'tagline': 'LOCAL-FIRST COMMAND CENTER',
      'footer': 'Thank you for your business!',
      'currency': 'INR',
      'plan_tier': 'growth',
      'enabled_features': <String, bool>{
        'inventory': true,
        'pos': true,
        'customers': true,
        'history': true,
        'team': true,
        'attendance': true,
        'expenses': true,
        'advanced_ops': true,
      },
      'settings': <String, dynamic>{
        'name': MobileRuntimeConfig.localShopName,
        'tagline': 'LOCAL-FIRST COMMAND CENTER',
        'footer': 'Thank you for your business!',
        'currency': 'INR',
        'plan_tier': 'growth',
      },
      'sourceMeta': <String, dynamic>{
        'shop_id': shopId,
        'session_uid': session.uid,
        'mode': MobileRuntimeConfig.backendSyncEnabled
            ? 'backend_sync'
            : 'local_first',
      },
    });
  }

  Future<bool> _syncWorkspaceAccessSession(MobileSession session) async {
    if (!MobileRuntimeConfig.backendSyncEnabled) {
      return true;
    }
    if (!session.hasShop) {
      return true;
    }

    try {
      final runtimeInfo = await _loadRuntimeInfo();
      final appInstanceId = await _shopRepository.ensureAppInstanceId();
      final heartbeat = await _backendApiClient.sendWorkspaceSessionHeartbeat(
        user: session.user,
        shopId: session.shopId!,
        payload: WorkspaceSessionHeartbeatPayload(
          appInstanceId: appInstanceId,
          deviceLabel:
              '${runtimeInfo.appName} ${runtimeInfo.versionLabel} (${Platform.operatingSystem})',
          platformName: Platform.operatingSystem,
          packageName: runtimeInfo.packageName,
          appVersion: runtimeInfo.version,
          buildNumber: runtimeInfo.buildNumber,
          releaseChannel: runtimeInfo.releaseChannel,
          releaseTag: runtimeInfo.releaseTag,
          metadata: <String, dynamic>{
            'role': session.normalizedRole,
            'role_profile_key': session.roleProfileKey,
            'release_sha': runtimeInfo.releaseSha,
            'pilot_scope': runtimeInfo.pilotScope,
          },
        ),
      );

      if (!heartbeat.shouldSignOut && !heartbeat.shouldWipeLocalData) {
        return true;
      }

      await _enforceWorkspaceSessionInstruction(session, heartbeat: heartbeat);
      return false;
    } on BackendApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        await _forceWorkspaceSignOut();
        return false;
      }
      debugPrint('Workspace session heartbeat skipped: $error');
      return true;
    } catch (error) {
      debugPrint('Workspace session heartbeat skipped: $error');
      return true;
    }
  }

  Future<void> _enforceWorkspaceSessionInstruction(
    MobileSession session, {
    required WorkspaceAccessSessionHeartbeatResult heartbeat,
  }) async {
    await _cancelSubscriptions();
    await _clearWorkspaceCache(clearSales: true);

    if (heartbeat.shouldWipeLocalData) {
      try {
        await _backendApiClient.acknowledgeWorkspaceSessionWipe(
          user: session.user,
          shopId: session.shopId!,
          sessionId: heartbeat.sessionId,
        );
      } catch (error) {
        debugPrint('Workspace session wipe acknowledge skipped: $error');
      }
    }

    await _finalizeLocalSignOut();
  }

  Future<void> _forceWorkspaceSignOut() async {
    await _cancelSubscriptions();
    await _clearWorkspaceCache(clearSales: true);
    await _finalizeLocalSignOut();
  }

  Future<void> _finalizeLocalSignOut() async {
    _session = null;
    _salesReadsUseBackend = false;
    setStatus(MobileSyncStatus.idle);
  }

  Future<AppRuntimeInfo> _loadRuntimeInfo() {
    return _runtimeInfoFuture ??= AppRuntimeInfo.load();
  }

  Future<Map<String, DomainControlState>> _refreshBackendDomainEpochs(
    MobileSession session,
    String shopId,
  ) async {
    if (!MobileRuntimeConfig.backendSyncEnabled) {
      return const <String, DomainControlState>{};
    }

    final domains = <String>[
      'inventory',
      'customers',
      'customer_ledger',
      'sales',
      'payments',
    ];

    final stateEntries = await Future.wait(
      domains.map((domain) async {
        try {
          final state = await _backendApiClient.getDomainState(
            user: session.user,
            shopId: shopId,
            domain: domain,
          );
          await _shopRepository.saveDomainState(state: state);
          return MapEntry(domain, state);
        } catch (error) {
          debugPrint('$domain domain state refresh skipped: $error');
          return null;
        }
      }),
    );

    return Map<String, DomainControlState>.fromEntries(
      stateEntries.whereType<MapEntry<String, DomainControlState>>(),
    );
  }

  Future<void> _cancelSubscriptions() async {
    _outboxRetryTimer?.cancel();
    _outboxRetryTimer = null;
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
  }

  void _startOutboxRetryLoop() {
    _outboxRetryTimer?.cancel();
    _outboxRetryTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      final session = _session;
      if (session == null || !session.hasShop) {
        return;
      }
      unawaited(_runBackgroundSyncTick(session));
    });
  }

  Future<void> _runBackgroundSyncTick(MobileSession session) async {
    final stillAllowed = await _syncWorkspaceAccessSession(session);
    if (!stillAllowed) {
      return;
    }

    await flushCommerceOutbox(checkAccess: false);
    if (_salesReadsUseBackend) {
      await _syncBackendSalesSnapshot(
        session,
        session.shopId!,
        updateStatus: false,
      );
    }
  }

  Future<void> _syncBackendSalesSnapshot(
    MobileSession session,
    String shopId, {
    bool updateStatus = true,
  }) async {
    try {
      final backendSales = await _backendApiClient.fetchRecentSales(
        user: session.user,
        shopId: shopId,
        limit: 200,
      );
      for (final sale in backendSales) {
        final updatedAt = _toEpoch(
          sale['occurred_at'] ?? sale['updated_at'] ?? sale['sale_date'],
        );
        await _salesRepository.mergeBackendSaleDocument(
          sale,
          updatedAt: updatedAt,
        );
      }
      if (updateStatus) {
        setStatus(MobileSyncStatus.idle);
      }
    } catch (error) {
      debugPrint('Backend sales snapshot sync failed: $error');
      if (updateStatus) {
        setStatus(MobileSyncStatus.error);
      }
    }
  }

  Future<void> _syncBackendInventorySnapshot(
    MobileSession session,
    String shopId, {
    bool updateStatus = true,
  }) async {
    try {
      final backendItems = await _backendApiClient.fetchInventoryItems(
        user: session.user,
        shopId: shopId,
      );
      final updatedAt = DateTime.now().millisecondsSinceEpoch;
      for (final item in backendItems) {
        await _inventoryRepository.mergeBackendInventoryItem(
          item,
          updatedAt: updatedAt,
        );
      }
      if (updateStatus) {
        setStatus(MobileSyncStatus.idle);
      }
    } catch (error) {
      debugPrint('Backend inventory snapshot sync failed: $error');
      if (updateStatus) {
        setStatus(MobileSyncStatus.error);
      }
    }
  }

  Future<void> _createInventoryItemLocally({
    required MobileSession session,
    required String name,
    required double sellPrice,
    required int openingStock,
    required String sku,
    required String barcode,
    required String category,
    required String subcategory,
    required String size,
    required String description,
    required double? costPrice,
    required String hsnCode,
    required double gstRate,
    required bool priceIncludesTax,
    required DateTime timestamp,
    String? imagePath,
  }) async {
    final itemId = 'local-${timestamp.microsecondsSinceEpoch}';
    final isoTimestamp = timestamp.toIso8601String();
    final payload = <String, dynamic>{
      'name': name,
      'price': sellPrice,
      'sell_price': sellPrice,
      'sku': sku,
      'barcode': barcode,
      'category': category,
      'subcategory': subcategory,
      'size': size,
      'description': description,
      'hsnCode': hsnCode,
      'gstRate': gstRate,
      'priceIncludesTax': priceIncludesTax,
      'stock': openingStock,
      'status': 'active',
      'tombstone': false,
      'sourceMeta': <String, dynamic>{
        'created_from': 'mobile_inventory',
        'actor_uid': session.uid,
      },
      'imagePath': imagePath,
      'createdAt': isoTimestamp,
      'updatedAt': isoTimestamp,
    };

    await _inventoryRepository.mergeInventoryDocument(
      itemId,
      payload,
      updatedAt: timestamp.millisecondsSinceEpoch,
    );

    if (costPrice != null) {
      final privatePayload = <String, dynamic>{
        'costPrice': costPrice,
        'updatedAt': isoTimestamp,
        'tombstone': false,
      };
      await _inventoryRepository.mergeInventoryPrivateDocument(
        itemId,
        privatePayload,
        updatedAt: timestamp.millisecondsSinceEpoch,
      );
    }
  }

  int _toEpoch(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    if (value is String) {
      final parsedDate = DateTime.tryParse(value);
      if (parsedDate != null) return parsedDate.millisecondsSinceEpoch;
      return int.tryParse(value) ?? DateTime.now().millisecondsSinceEpoch;
    }
    return DateTime.now().millisecondsSinceEpoch;
  }
}
