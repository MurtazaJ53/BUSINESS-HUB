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

  factory MobileSession.localOwner() {
    final user = MobileAuthUser.localOwner();
    return MobileSession(
      user: user,
      email: user.email,
      uid: user.uid,
      role: 'owner',
      membershipId: 'local-owner-membership',
      permissions: const <String, dynamic>{
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
        'customers': {
          'view': true,
          'create': true,
          'edit': true,
          'delete': true,
        },
        'expenses': {'view': true, 'create': true, 'delete': true},
        'team': {'view': true, 'edit': true, 'view_cost': true},
        'analytics': {'view': true},
        'settings': {'view': true, 'edit': true},
      },
      shopId: MobileRuntimeConfig.localShopId,
      isElevatedAdmin: true,
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
