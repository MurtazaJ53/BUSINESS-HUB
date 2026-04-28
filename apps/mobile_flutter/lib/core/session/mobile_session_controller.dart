import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mobile_session.dart';

final mobileSessionProvider = StreamProvider<MobileSession?>((ref) async* {
  await for (final user in FirebaseAuth.instance.idTokenChanges()) {
    if (user == null) {
      yield null;
      continue;
    }

    final token = await user.getIdTokenResult();
    final claims = token.claims == null
        ? null
        : Map<String, dynamic>.from(token.claims!);
    final recoveredContext = await _recoverWorkspaceContext(user, claims);

    yield MobileSession.fromClaims(
      user,
      claims,
      fallbackRole: recoveredContext?.role,
      fallbackPermissions: recoveredContext?.permissions,
      fallbackShopId: recoveredContext?.shopId,
      fallbackIsElevatedAdmin: recoveredContext?.isElevatedAdmin ?? false,
    );
  }
});

class _RecoveredWorkspaceContext {
  const _RecoveredWorkspaceContext({
    required this.shopId,
    required this.role,
    this.permissions,
    this.isElevatedAdmin = false,
  });

  final String shopId;
  final String? role;
  final Map<String, dynamic>? permissions;
  final bool isElevatedAdmin;
}

Future<_RecoveredWorkspaceContext?> _recoverWorkspaceContext(
  User user,
  Map<String, dynamic>? claims,
) async {
  if (claims?['shopId'] != null && claims!['shopId'].toString().isNotEmpty) {
    return _RecoveredWorkspaceContext(
      shopId: claims['shopId'].toString(),
      role: claims['role']?.toString(),
      permissions: claims['perms'] is Map
          ? Map<String, dynamic>.from(claims['perms'] as Map)
          : null,
      isElevatedAdmin: claims['shopAdmin'] == true,
    );
  }

  final firestore = FirebaseFirestore.instance;

  try {
    final userSnapshot = await firestore.doc('users/${user.uid}').get();
    final userData = userSnapshot.data();
    final shopId = userData?['shopId']?.toString();
    if (shopId != null && shopId.isNotEmpty) {
      return _RecoveredWorkspaceContext(
        shopId: shopId,
        role: userData?['role']?.toString(),
      );
    }
  } catch (_) {
    // Keep falling through to owner-based recovery.
  }

  try {
    final ownedShopQuery = await firestore
        .collection('shops')
        .where('ownerId', isEqualTo: user.uid)
        .limit(1)
        .get();

    if (ownedShopQuery.docs.isEmpty) {
      return null;
    }

    final shopId = ownedShopQuery.docs.first.id;
    await firestore.doc('users/${user.uid}').set({
      'email': user.email,
      'shopId': shopId,
      'role': 'admin',
      'updatedAt': DateTime.now().toIso8601String(),
    }, SetOptions(merge: true));

    return _RecoveredWorkspaceContext(
      shopId: shopId,
      role: 'admin',
      isElevatedAdmin: true,
    );
  } catch (_) {
    return null;
  }
}
