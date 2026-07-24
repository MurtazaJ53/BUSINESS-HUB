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

  /// A user authenticated against the backend; [accessToken] is the JWT the
  /// client sends as a Bearer credential on every request.
  factory MobileAuthUser.cloud({
    required String uid,
    required String email,
    required String displayName,
    required String accessToken,
  }) {
    return MobileAuthUser(
      uid: uid,
      email: email,
      displayName: displayName.trim().isEmpty ? email : displayName.trim(),
      authToken: accessToken,
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
