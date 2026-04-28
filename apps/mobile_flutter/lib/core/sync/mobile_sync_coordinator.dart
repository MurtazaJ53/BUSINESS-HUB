import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

enum MobileSyncStatus {
  idle,
  syncing,
  offline,
  error,
}

class MobileSyncCoordinator {
  MobileSyncCoordinator({
    required FirebaseFirestore firestore,
    required ShopRepository shopRepository,
    required InventoryRepository inventoryRepository,
    required SalesRepository salesRepository,
    required this.setStatus,
  })  : _firestore = firestore,
        _shopRepository = shopRepository,
        _inventoryRepository = inventoryRepository,
        _salesRepository = salesRepository;

  final FirebaseFirestore _firestore;
  final ShopRepository _shopRepository;
  final InventoryRepository _inventoryRepository;
  final SalesRepository _salesRepository;
  final void Function(MobileSyncStatus status) setStatus;

  MobileSession? _session;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  Future<void> handleSession(MobileSession? session) async {
    if (session?.shopId == _session?.shopId && session?.role == _session?.role) {
      return;
    }

    await _cancelSubscriptions();
    _session = session;

    if (session == null || !session.hasShop) {
      setStatus(MobileSyncStatus.idle);
      return;
    }

    setStatus(MobileSyncStatus.syncing);
    final shopId = session.shopId!;

    _subscriptions.add(
      _firestore.doc('shops/$shopId').snapshots().listen(
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
      _firestore.collection('shops/$shopId/inventory').snapshots().listen(
        (snapshot) async {
          for (final change in snapshot.docChanges) {
            if (change.doc.metadata.hasPendingWrites) continue;
            final data = change.doc.data() ?? <String, dynamic>{};
            if (change.type == DocumentChangeType.removed) {
              data['tombstone'] = true;
            }
            await _inventoryRepository.mergeInventoryDocument(
              change.doc.id,
              data,
              updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
            );
          }
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
        _firestore.collection('shops/$shopId/inventory_private').snapshots().listen(
          (snapshot) async {
            for (final change in snapshot.docChanges) {
              if (change.doc.metadata.hasPendingWrites) continue;
              final data = change.doc.data() ?? <String, dynamic>{};
              if (change.type == DocumentChangeType.removed) {
                data['tombstone'] = true;
              }
              await _inventoryRepository.mergeInventoryPrivateDocument(
                change.doc.id,
                data,
                updatedAt: _toEpoch(data['updatedAt'] ?? data['lastPurchaseDate']),
              );
            }
            setStatus(MobileSyncStatus.idle);
          },
          onError: (error, stackTrace) {
            debugPrint('Inventory private sync failed: $error');
            setStatus(MobileSyncStatus.error);
          },
        ),
      );
    }

    _subscriptions.add(
      _firestore
          .collection('shops/$shopId/sales')
          .limit(500)
          .snapshots()
          .listen(
        (snapshot) async {
          for (final change in snapshot.docChanges) {
            if (change.doc.metadata.hasPendingWrites) continue;
            final data = change.doc.data() ?? <String, dynamic>{};
            if (change.type == DocumentChangeType.removed) {
              data['tombstone'] = true;
            }
            await _salesRepository.mergeRemoteSaleDocument(
              change.doc.id,
              data,
              updatedAt: _toEpoch(data['updatedAt'] ?? data['createdAt']),
            );
          }
          setStatus(MobileSyncStatus.idle);
        },
        onError: (error, stackTrace) {
          debugPrint('Sales sync failed: $error');
          setStatus(MobileSyncStatus.error);
        },
      ),
    );
  }

  Future<void> submitSale(LocalSaleCommit commit) async {
    final session = _session;
    if (session == null || !session.hasShop) {
      return;
    }

    final shopId = session.shopId!;
    final batch = _firestore.batch();
    final saleRef = _firestore.doc('shops/$shopId/sales/${commit.saleId}');
    batch.set(
      saleRef,
      commit.toFirestorePayload(staffId: session.uid),
      SetOptions(merge: true),
    );

    for (final entry in commit.inventoryDeltas.entries) {
      final ref = _firestore.doc('shops/$shopId/inventory/${entry.key}');
      batch.set(
        ref,
        {
          'stock': FieldValue.increment(entry.value),
          'updatedAt': DateTime.now().millisecondsSinceEpoch,
        },
        SetOptions(merge: true),
      );
    }

    try {
      setStatus(MobileSyncStatus.syncing);
      await batch.commit();
      setStatus(MobileSyncStatus.idle);
    } catch (error) {
      debugPrint('Sale upload failed: $error');
      setStatus(MobileSyncStatus.error);
      rethrow;
    }
  }

  Future<void> dispose() => _cancelSubscriptions();

  Future<void> _cancelSubscriptions() async {
    for (final subscription in _subscriptions) {
      await subscription.cancel();
    }
    _subscriptions.clear();
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
