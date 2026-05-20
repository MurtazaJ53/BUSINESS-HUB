import 'package:firebase_auth/firebase_auth.dart';

class MobileSession {
  const MobileSession({
    required this.user,
    required this.email,
    required this.uid,
    required this.role,
    required this.permissions,
    required this.shopId,
    required this.isElevatedAdmin,
  });

  final User user;
  final String email;
  final String uid;
  final String? role;
  final Map<String, dynamic>? permissions;
  final String? shopId;
  final bool isElevatedAdmin;

  bool get isSignedIn => true;
  bool get hasShop => shopId != null && shopId!.isNotEmpty;
  String get normalizedRole => (role ?? '').trim().toLowerCase();
  bool get isAdmin => normalizedRole == 'admin';
  bool get isManager => normalizedRole == 'manager';
  bool get isCashierLike =>
      normalizedRole == 'cashier' ||
      normalizedRole == 'staff' ||
      (!isElevatedAdmin && !isManager && !isAdmin);
  bool get isOwnerLike => isElevatedAdmin || isAdmin;
  bool get canViewCost => isOwnerLike;
  bool get canAccessAdvancedOps => isOwnerLike;
  bool get landsOnPosByDefault => isCashierLike;
  String get defaultRoute => landsOnPosByDefault ? '/pos' : '/dashboard';
  String get displayRoleLabel {
    if (isElevatedAdmin) {
      return 'OWNER';
    }
    if (isAdmin) {
      return 'ADMIN';
    }
    if (isManager) {
      return 'MANAGER';
    }
    if (normalizedRole == 'cashier') {
      return 'CASHIER';
    }
    if (normalizedRole == 'staff') {
      return 'STAFF';
    }
    return 'OPERATOR';
  }

  static MobileSession fromClaims(
    User user,
    Map<String, dynamic>? claims, {
    String? fallbackRole,
    Map<String, dynamic>? fallbackPermissions,
    String? fallbackShopId,
    bool fallbackIsElevatedAdmin = false,
  }) {
    return MobileSession(
      user: user,
      email: user.email ?? '',
      uid: user.uid,
      role: claims?['role']?.toString() ?? fallbackRole,
      permissions: claims?['perms'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(claims!['perms'] as Map)
          : fallbackPermissions,
      shopId: claims?['shopId']?.toString() ?? fallbackShopId,
      isElevatedAdmin: claims?['shopAdmin'] == true || fallbackIsElevatedAdmin,
    );
  }
}
