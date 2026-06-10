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

  final String uid;
  final String email;
  final String displayName;
  final String? authToken;

  Future<String?> getIdToken() async => authToken;
}

typedef User = MobileAuthUser;
