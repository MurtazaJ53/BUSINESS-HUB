import 'dart:async';
import 'dart:collection';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../backend/backend_api_client.dart';
import '../database/mobile_repository.dart';
import '../models/mobile_models.dart';
import '../models/mobile_session.dart';
import '../session/mobile_session_controller.dart';

final syncStatusProvider =
    NotifierProvider<SyncStatusNotifier, MobileSyncStatus>(
      SyncStatusNotifier.new,
    );

class SyncStatusNotifier extends Notifier<MobileSyncStatus> {
  @override
  MobileSyncStatus build() => MobileSyncStatus.idle;

  void setStatus(MobileSyncStatus next) {
    state = next;
  }
}

final mobileSyncCoordinatorProvider = Provider<MobileSyncCoordinator>((ref) {
  final coordinator = MobileSyncCoordinator(
    backendApiClient: ref.read(backendApiClientProvider),
    firestore: FirebaseFirestore.instance,
    shopRepository: ref.read(shopRepositoryProvider),
    inventoryRepository: ref.read(inventoryRepositoryProvider),
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
    required SalesRepository salesRepository,
    required this.setStatus,
  }) : _backendApiClient = backendApiClient,
       _firestore = firestore,
       _shopRepository = shopRepository,
       _inventoryRepository = inventoryRepository,
       _salesRepository = salesRepository;

  final BackendApiClient _backendApiClient;
  final FirebaseFirestore _firestore;
  final ShopRepository _shopRepository;
  final InventoryRepository _inventoryRepository;
  final SalesRepository _salesRepository;
  final void Function(MobileSyncStatus status) setStatus;

  MobileSession? _session;
  bool _salesReadsUseBackend = false;
  bool _isFlushingOutbox = false;
  Timer? _outboxRetryTimer;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

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

    if (session == null || previousShopId != session.shopId) {
      await _clearWorkspaceCache(clearSales: true);
    } else if (force) {
      await _clearWorkspaceCache(clearSales: false);
    }

    _session = session;

    if (session == null || !session.hasShop) {
      _salesReadsUseBackend = false;
      setStatus(MobileSyncStatus.idle);
      return;
    }

    setStatus(MobileSyncStatus.syncing);
    final shopId = session.shopId!;
    await _ensureAdminBootstrap(session, shopId);
    final domainStates = await _refreshBackendDomainEpochs(session, shopId);
    final salesState = domainStates['sales'];
    _salesReadsUseBackend = salesState?.isPostgresPrimary ?? false;
    await _primeWorkspaceSnapshot(
      shopId,
      includeCost: session.canViewCost,
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
    await flushCommerceOutbox();
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
    if (!(session.isAdmin || session.isElevatedAdmin)) {
      throw StateError(
        'Only workspace admins can change mobile workspace settings.',
      );
    }

    setStatus(MobileSyncStatus.syncing);
    final payload = <String, dynamic>{
      'name': currentShop.name,
      'tagline': tagline,
      'footer': footer,
      'phone': phone,
      'currency': currentShop.currency,
      'settings': <String, dynamic>{
        'name': currentShop.name,
        'tagline': tagline,
        'footer': footer,
        'phone': phone,
        'currency': currentShop.currency,
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

  Future<CommerceSyncResult> flushCommerceOutbox({
    String? triggerCommandId,
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

    setStatus(MobileSyncStatus.syncing);
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
        await _syncBackendSalesSnapshot(session, session.shopId!);
      }

      setStatus(hadFailure ? MobileSyncStatus.error : MobileSyncStatus.idle);
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
    ];
    if (clearSales) {
      futures.add(_salesRepository.clearWorkspace());
    }
    await Future.wait<void>(futures);
  }

  Future<void> _primeWorkspaceSnapshot(
    String shopId, {
    required bool includeCost,
    required bool includeFirestoreSales,
  }) async {
    try {
      final snapshotFutures = await Future.wait([
        _firestore.doc('shops/$shopId').get(),
        _firestore.collection('shops/$shopId/inventory').get(),
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
      final salesSnapshot = includeFirestoreSales
          ? snapshotFutures[2] as QuerySnapshot<Map<String, dynamic>>
          : null;
      final inventoryPrivateSnapshot = includeCost
          ? snapshotFutures[includeFirestoreSales ? 3 : 2]
                as QuerySnapshot<Map<String, dynamic>>
          : null;

      if (shopSnapshot.exists && shopSnapshot.data() != null) {
        await _shopRepository.saveShopDocument(shopSnapshot.data()!);
      }

      await _mergeInventoryDocuments(inventorySnapshot.docs);
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
    final states = <String, DomainControlState>{};
    final domains = <String>[
      'inventory',
      'customers',
      'customer_ledger',
      'sales',
      'payments',
    ];

    for (final domain in domains) {
      try {
        final state = await _backendApiClient.getDomainState(
          user: session.user,
          shopId: shopId,
          domain: domain,
        );
        await _shopRepository.saveDomainState(state: state);
        states[domain] = state;
      } catch (error) {
        debugPrint('$domain domain state refresh skipped: $error');
      }
    }

    return states;
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
    _outboxRetryTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      final session = _session;
      if (session == null || !session.hasShop) {
        return;
      }
      unawaited(flushCommerceOutbox());
      if (_salesReadsUseBackend) {
        unawaited(_syncBackendSalesSnapshot(session, session.shopId!));
      }
    });
  }

  Future<void> _syncBackendSalesSnapshot(
    MobileSession session,
    String shopId,
  ) async {
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
      setStatus(MobileSyncStatus.idle);
    } catch (error) {
      debugPrint('Backend sales snapshot sync failed: $error');
      setStatus(MobileSyncStatus.error);
    }
  }

  Future<void> _ensureAdminBootstrap(
    MobileSession session,
    String shopId,
  ) async {
    if (!(session.isAdmin || session.isElevatedAdmin)) {
      return;
    }

    final timestamp = DateTime.now();
    final isoTimestamp = timestamp.toIso8601String();
    final updatedAt = timestamp.millisecondsSinceEpoch;

    try {
      await _firestore.doc('users/${session.uid}').set({
        'email': session.email,
        'shopId': shopId,
        'role': 'admin',
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
        'role': 'admin',
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
