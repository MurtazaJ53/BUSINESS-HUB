import 'dart:async';
import 'dart:collection';
import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../backend/backend_api_client.dart';
import '../database/mobile_repository.dart';
import '../models/mobile_models.dart';
import '../models/mobile_session.dart';
import '../runtime/app_runtime_info.dart';
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
    firestore: FirebaseFirestore.instance,
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
    required FirebaseFirestore firestore,
    required ShopRepository shopRepository,
    required InventoryRepository inventoryRepository,
    required CustomerRepository customerRepository,
    required SalesRepository salesRepository,
    required this.setStatus,
  }) : _backendApiClient = backendApiClient,
       _firestore = firestore,
       _shopRepository = shopRepository,
       _inventoryRepository = inventoryRepository,
       _customerRepository = customerRepository,
       _salesRepository = salesRepository;

  final BackendApiClient _backendApiClient;
  final FirebaseFirestore _firestore;
  final ShopRepository _shopRepository;
  final InventoryRepository _inventoryRepository;
  final CustomerRepository _customerRepository;
  final SalesRepository _salesRepository;
  final void Function(MobileSyncStatus status) setStatus;

  MobileSession? _session;
  bool _customersReadUseBackend = false;
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
    final hasAccess = await _syncWorkspaceAccessSession(session);
    if (!hasAccess) {
      return;
    }
    final setupResults = await Future.wait<Object?>(<Future<Object?>>[
      _ensureAdminBootstrap(session, shopId),
      _refreshBackendDomainEpochs(session, shopId),
    ]);
    final domainStates = setupResults[1] as Map<String, DomainControlState>;
    final customerState = domainStates['customers'];
    final salesState = domainStates['sales'];
    _customersReadUseBackend = customerState?.isPostgresPrimary ?? false;
    _salesReadsUseBackend = salesState?.isPostgresPrimary ?? false;
    await _primeWorkspaceSnapshot(
      shopId,
      includeCost: session.canViewCost,
      includeFirestoreCustomers: !_customersReadUseBackend,
      includeFirestoreSales: !_salesReadsUseBackend,
    );

    _subscriptions.add(
      _firestore
          .doc('shops/$shopId')
          .snapshots()
          .listen(
            (snapshot) async {
              if (!snapshot.exists || snapshot.data() == null) return;
              await _shopRepository.saveShopDocument(snapshot.data()!);
              setStatus(MobileSyncStatus.idle);
            },
            onError: (error, stackTrace) {
              debugPrint('Shop sync failed: $error');
              setStatus(MobileSyncStatus.error);
            },
          ),
    );

    _subscriptions.add(
      _firestore
          .collection('shops/$shopId/inventory')
          .snapshots()
          .listen(
            (snapshot) async {
              await _mergeInventoryChanges(snapshot.docChanges);
              setStatus(MobileSyncStatus.idle);
            },
            onError: (error, stackTrace) {
              debugPrint('Inventory sync failed: $error');
              setStatus(MobileSyncStatus.error);
            },
          ),
    );

    if (session.canViewCost) {
      _subscriptions.add(
        _firestore
            .collection('shops/$shopId/inventory_private')
            .snapshots()
            .listen(
              (snapshot) async {
                await _mergeInventoryPrivateChanges(snapshot.docChanges);
                setStatus(MobileSyncStatus.idle);
              },
              onError: (error, stackTrace) {
                debugPrint('Inventory private sync failed: $error');
                setStatus(MobileSyncStatus.error);
              },
            ),
      );
    }

    if (!_customersReadUseBackend) {
      _subscriptions.add(
        _firestore
            .collection('shops/$shopId/customers')
            .limit(1500)
            .snapshots()
            .listen(
              (snapshot) async {
                await _mergeCustomerChanges(snapshot.docChanges);
                setStatus(MobileSyncStatus.idle);
              },
              onError: (error, stackTrace) {
                debugPrint('Customer sync failed: $error');
                setStatus(MobileSyncStatus.error);
              },
            ),
      );
    }

    if (_salesReadsUseBackend) {
      await _syncBackendSalesSnapshot(session, shopId);
    } else {
      _subscriptions.add(
        _firestore
            .collection('shops/$shopId/sales')
            .orderBy('date', descending: true)
            .limit(1500)
            .snapshots()
            .listen(
              (snapshot) async {
                await _mergeSalesChanges(snapshot.docChanges);
                setStatus(MobileSyncStatus.idle);
              },
              onError: (error, stackTrace) {
                debugPrint('Sales sync failed: $error');
                setStatus(MobileSyncStatus.error);
              },
            ),
      );
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
      await _firestore.doc('shops/${session.shopId!}').set(<String, dynamic>{
        ...payload,
        'settings': <String, dynamic>{
          ...(payload['settings'] as Map<String, dynamic>),
          'updatedAt': FieldValue.serverTimestamp(),
        },
      }, SetOptions(merge: true));
      setStatus(MobileSyncStatus.idle);
    } catch (error) {
      debugPrint('Workspace settings update failed: $error');
      setStatus(MobileSyncStatus.error);
      rethrow;
    }
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

  Future<bool> _syncWorkspaceAccessSession(MobileSession session) async {
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
    _customersReadUseBackend = false;
    _salesReadsUseBackend = false;
    setStatus(MobileSyncStatus.idle);
    try {
      await FirebaseAuth.instance.signOut();
    } catch (error) {
      debugPrint('Workspace sign-out skipped: $error');
    }
  }

  Future<AppRuntimeInfo> _loadRuntimeInfo() {
    return _runtimeInfoFuture ??= AppRuntimeInfo.load();
  }

  Future<void> _primeWorkspaceSnapshot(
    String shopId, {
    required bool includeCost,
    required bool includeFirestoreCustomers,
    required bool includeFirestoreSales,
  }) async {
    try {
      final snapshotFutures = await Future.wait([
        _firestore.doc('shops/$shopId').get(),
        _firestore.collection('shops/$shopId/inventory').get(),
        if (includeFirestoreCustomers)
          _firestore.collection('shops/$shopId/customers').limit(1500).get(),
        if (includeFirestoreSales)
          _firestore
              .collection('shops/$shopId/sales')
              .orderBy('date', descending: true)
              .limit(1500)
              .get(),
        if (includeCost)
          _firestore.collection('shops/$shopId/inventory_private').get(),
      ]);

      final shopSnapshot =
          snapshotFutures[0] as DocumentSnapshot<Map<String, dynamic>>;
      final inventorySnapshot =
          snapshotFutures[1] as QuerySnapshot<Map<String, dynamic>>;
      final customerSnapshot = includeFirestoreCustomers
          ? snapshotFutures[2] as QuerySnapshot<Map<String, dynamic>>
          : null;
      final salesSnapshot = includeFirestoreSales
          ? snapshotFutures[includeFirestoreCustomers ? 3 : 2]
                as QuerySnapshot<Map<String, dynamic>>
          : null;
      final inventoryPrivateSnapshot = includeCost
          ? snapshotFutures[(includeFirestoreCustomers ? 1 : 0) +
                    (includeFirestoreSales ? 1 : 0) +
                    2]
                as QuerySnapshot<Map<String, dynamic>>
          : null;

      if (shopSnapshot.exists && shopSnapshot.data() != null) {
        await _shopRepository.saveShopDocument(shopSnapshot.data()!);
      }

      await _mergeInventoryDocuments(inventorySnapshot.docs);
      if (customerSnapshot != null) {
        await _mergeCustomerDocuments(customerSnapshot.docs);
      }
      if (inventoryPrivateSnapshot != null) {
        await _mergeInventoryPrivateDocuments(inventoryPrivateSnapshot.docs);
      }
      if (salesSnapshot != null) {
        await _mergeSalesDocuments(salesSnapshot.docs);
      }
    } catch (error) {
      debugPrint('Initial workspace bootstrap failed: $error');
      setStatus(MobileSyncStatus.error);
    }
  }

  Future<Map<String, DomainControlState>> _refreshBackendDomainEpochs(
    MobileSession session,
    String shopId,
  ) async {
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

  Future<void> _ensureAdminBootstrap(
    MobileSession session,
    String shopId,
  ) async {
    if (!session.isOwnerLike) {
      return;
    }

    final roleValue = session.isOwner ? 'owner' : 'admin';

    final timestamp = DateTime.now();
    final isoTimestamp = timestamp.toIso8601String();
    final updatedAt = timestamp.millisecondsSinceEpoch;

    try {
      await _firestore.doc('users/${session.uid}').set({
        'email': session.email,
        'shopId': shopId,
        'role': roleValue,
        'updatedAt': isoTimestamp,
      }, SetOptions(merge: true));
    } catch (error) {
      debugPrint('User profile sync skipped: $error');
    }

    try {
      await _firestore.doc('shops/$shopId/staff/${session.uid}').set({
        'id': session.uid,
        'name':
            session.user.displayName ??
            (session.email.isNotEmpty
                ? session.email.split('@').first
                : 'Admin'),
        'email': session.email,
        'phone': '-',
        'role': roleValue,
        'status': 'active',
        'joinedAt': isoTimestamp,
        'permissions': _adminPermissionTemplate,
        'updatedAt': updatedAt,
      }, SetOptions(merge: true));
    } catch (error) {
      debugPrint('Admin staff heal skipped: $error');
    }
  }

  Future<void> _mergeInventoryChanges(
    List<DocumentChange<Map<String, dynamic>>> changes,
  ) async {
    final tasks = <Future<void>>[];
    for (final change in changes) {
      if (change.doc.metadata.hasPendingWrites) {
        continue;
      }
      final data = Map<String, dynamic>.from(
        change.doc.data() ?? const <String, dynamic>{},
      );
      if (change.type == DocumentChangeType.removed) {
        data['tombstone'] = true;
      }
      tasks.add(
        _inventoryRepository.mergeInventoryDocument(
          change.doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeInventoryDocuments(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) async {
    final tasks = <Future<void>>[];
    for (final doc in docs) {
      final data = Map<String, dynamic>.from(doc.data());
      tasks.add(
        _inventoryRepository.mergeInventoryDocument(
          doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeInventoryPrivateChanges(
    List<DocumentChange<Map<String, dynamic>>> changes,
  ) async {
    final tasks = <Future<void>>[];
    for (final change in changes) {
      if (change.doc.metadata.hasPendingWrites) {
        continue;
      }
      final data = Map<String, dynamic>.from(
        change.doc.data() ?? const <String, dynamic>{},
      );
      if (change.type == DocumentChangeType.removed) {
        data['tombstone'] = true;
      }
      tasks.add(
        _inventoryRepository.mergeInventoryPrivateDocument(
          change.doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['lastPurchaseDate']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeInventoryPrivateDocuments(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) async {
    final tasks = <Future<void>>[];
    for (final doc in docs) {
      final data = Map<String, dynamic>.from(doc.data());
      tasks.add(
        _inventoryRepository.mergeInventoryPrivateDocument(
          doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['lastPurchaseDate']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeSalesChanges(
    List<DocumentChange<Map<String, dynamic>>> changes,
  ) async {
    final tasks = <Future<void>>[];
    for (final change in changes) {
      if (change.doc.metadata.hasPendingWrites) {
        continue;
      }
      final data = Map<String, dynamic>.from(
        change.doc.data() ?? const <String, dynamic>{},
      );
      if (change.type == DocumentChangeType.removed) {
        data['tombstone'] = true;
      }
      tasks.add(
        _salesRepository.mergeRemoteSaleDocument(
          change.doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeSalesDocuments(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) async {
    final tasks = <Future<void>>[];
    for (final doc in docs) {
      final data = Map<String, dynamic>.from(doc.data());
      tasks.add(
        _salesRepository.mergeRemoteSaleDocument(
          doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeCustomerChanges(
    List<DocumentChange<Map<String, dynamic>>> changes,
  ) async {
    final tasks = <Future<void>>[];
    for (final change in changes) {
      if (change.doc.metadata.hasPendingWrites) {
        continue;
      }
      final data = Map<String, dynamic>.from(
        change.doc.data() ?? const <String, dynamic>{},
      );
      if (change.type == DocumentChangeType.removed) {
        data['tombstone'] = true;
      }
      tasks.add(
        _customerRepository.mergeRemoteCustomerDocument(
          change.doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  Future<void> _mergeCustomerDocuments(
    List<QueryDocumentSnapshot<Map<String, dynamic>>> docs,
  ) async {
    final tasks = <Future<void>>[];
    for (final doc in docs) {
      final data = Map<String, dynamic>.from(doc.data());
      tasks.add(
        _customerRepository.mergeRemoteCustomerDocument(
          doc.id,
          data,
          updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
        ),
      );
    }
    if (tasks.isNotEmpty) {
      await Future.wait(tasks);
    }
  }

  int _toEpoch(Object? value) {
    if (value is Timestamp) return value.millisecondsSinceEpoch;
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

final Map<String, dynamic> _adminPermissionTemplate = UnmodifiableMapView({
  'inventory': {
    'view': true,
    'create': true,
    'edit': true,
    'delete': true,
    'view_cost': true,
  },
  'sales': {
    'view': true,
    'create': true,
    'edit': true,
    'void_sale': true,
    'view_profit': true,
    'override_price': true,
  },
  'customers': {'view': true, 'create': true, 'edit': true, 'delete': true},
  'expenses': {'view': true, 'create': true, 'delete': true},
  'team': {'view': true, 'edit': true, 'view_cost': true},
  'analytics': {'view': true},
  'settings': {'view': true, 'edit': true},
});
