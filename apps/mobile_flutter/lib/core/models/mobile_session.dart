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
  bool get isAdmin => role == 'admin';
  bool get canViewCost => isAdmin || isElevatedAdmin;

  static MobileSession fromClaims(
    User user,
    Map<String, dynamic>? claims,
  ) {
    return MobileSession(
      user: user,
      email: user.email ?? '',
      uid: user.uid,
      role: claims?['role']?.toString(),
      permissions: claims?['perms'] is Map<String, dynamic>
          ? claims!['perms'] as Map<String, dynamic>
          : null,
      shopId: claims?['shopId']?.toString(),
      isElevatedAdmin: claims?['shopAdmin'] == true,
    );
  }
}
