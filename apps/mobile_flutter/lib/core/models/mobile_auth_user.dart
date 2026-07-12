import '../runtime/mobile_runtime_config.dart';

class MobileAuthUser {
  const MobileAuthUser({
    required this.uid,
    required this.email,
    required this.displayName,
    this.authToken,
  });

  factory MobileAuthUser.localOwner() {
    return const MobileAuthUser(
      uid: 'local-owner',
      email: MobileRuntimeConfig.localOwnerEmail,
      displayName: MobileRuntimeConfig.localOwnerName,
    );
  }

  factory MobileAuthUser.local({required String id, required String name}) {
    return MobileAuthUser(
      uid: id,
      email: MobileRuntimeConfig.localOwnerEmail,
      displayName: name.trim().isEmpty ? 'Staff' : name.trim(),
    );
  }

  final String uid;
  final String email;
  final String displayName;
  final String? authToken;

  Future<String?> getIdToken() async => authToken;
}

typedef User = MobileAuthUser;
