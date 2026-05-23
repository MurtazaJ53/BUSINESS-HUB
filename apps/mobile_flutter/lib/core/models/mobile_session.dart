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
  bool get isOwner => normalizedRole == 'owner' || isElevatedAdmin;
  bool get isAdmin => normalizedRole == 'admin';
  bool get isManager => normalizedRole == 'manager';
  bool get isViewer => normalizedRole == 'viewer';
  bool get isReadOnly => isViewer;
  bool get isCashierLike =>
      normalizedRole == 'cashier' ||
      normalizedRole == 'staff' ||
      (normalizedRole.isEmpty && !isElevatedAdmin && !isManager && !isAdmin);
  bool get isOwnerLike => isOwner || isAdmin;
  bool get canViewCost => isOwnerLike;
  bool get canAccessAdvancedOps => isOwnerLike;
  bool get landsOnPosByDefault => isCashierLike;
  String get defaultRoute => landsOnPosByDefault ? '/pos' : '/dashboard';
  String get roleProfileKey {
    if (isOwner) {
      return 'owner_control';
    }
    if (isAdmin || isManager) {
      return 'store_admin';
    }
    if (isViewer) {
      return 'read_only';
    }
    return 'daily_operator';
  }

  String get displayRoleLabel {
    if (isOwner) {
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
    if (isViewer) {
      return 'VIEWER';
    }
    return 'OPERATOR';
  }

  String get roleSummary {
    if (isOwner) {
      return 'Business control and workspace decisions.';
    }
    if (isAdmin || isManager) {
      return 'Store management, settings, and operational controls.';
    }
    if (isViewer) {
      return 'Read-only lookup and oversight access.';
    }
    return 'Daily sales, stock, and customer work.';
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
      isElevatedAdmin:
          claims?['shopAdmin'] == true ||
          claims?['role']?.toString().trim().toLowerCase() == 'owner' ||
          fallbackIsElevatedAdmin,
    );
  }
}
