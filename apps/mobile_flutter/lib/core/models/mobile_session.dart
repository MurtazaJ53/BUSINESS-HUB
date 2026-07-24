import '../runtime/mobile_runtime_config.dart';
import 'mobile_auth_user.dart';

class MobileSession {
  const MobileSession({
    required this.user,
    required this.email,
    required this.uid,
    required this.role,
    required this.membershipId,
    required this.permissions,
    required this.shopId,
    required this.isElevatedAdmin,
  });

  /// Full owner/admin permission set, shared by the local owner and by a
  /// cloud-authenticated owner/admin.
  static const Map<String, dynamic> fullControlPermissions = <String, dynamic>{
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
  };

  factory MobileSession.localOwner() {
    final user = MobileAuthUser.localOwner();
    return MobileSession(
      user: user,
      email: user.email,
      uid: user.uid,
      role: 'owner',
      membershipId: 'local-owner-membership',
      permissions: fullControlPermissions,
      shopId: MobileRuntimeConfig.localShopId,
      isElevatedAdmin: true,
    );
  }

  /// A session backed by a real backend login (JWT). The [user] carries the
  /// access token as its auth token, so backend requests send it as a Bearer
  /// credential. [shopId] is the real backend shop, resolved from the caller's
  /// membership.
  factory MobileSession.authenticated({
    required MobileAuthUser user,
    required String shopId,
    required String role,
    required String membershipId,
    required String email,
  }) {
    final normalized = role.trim().toLowerCase();
    final elevated = normalized == 'owner' || normalized == 'admin';
    return MobileSession(
      user: user,
      email: email,
      uid: user.uid,
      role: normalized.isEmpty ? 'staff' : normalized,
      membershipId: membershipId,
      permissions: elevated ? fullControlPermissions : const <String, dynamic>{},
      shopId: shopId,
      isElevatedAdmin: elevated,
    );
  }

  /// Local session for a resolved staff member (multi-user). Owner is elevated;
  /// everyone else is gated by [role] via the getters below.
  factory MobileSession.localUser({
    required String staffId,
    required String name,
    required String role,
  }) {
    final normalized = role.trim().toLowerCase();
    if (normalized == 'owner') {
      return MobileSession.localOwner();
    }
    return MobileSession(
      user: MobileAuthUser.local(id: staffId, name: name),
      email: MobileRuntimeConfig.localOwnerEmail,
      uid: staffId,
      role: normalized.isEmpty ? 'staff' : normalized,
      membershipId: staffId,
      permissions: const <String, dynamic>{},
      shopId: MobileRuntimeConfig.localShopId,
      isElevatedAdmin: false,
    );
  }

  final MobileAuthUser user;
  final String email;
  final String uid;
  final String? role;
  final String? membershipId;
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
}
