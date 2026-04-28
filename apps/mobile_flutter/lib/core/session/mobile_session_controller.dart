import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/mobile_session.dart';

final mobileSessionProvider = StreamProvider<MobileSession?>((ref) async* {
  await for (final user in FirebaseAuth.instance.idTokenChanges()) {
    if (user == null) {
      yield null;
      continue;
    }

    final token = await user.getIdTokenResult(true);
    final claims = token.claims == null
        ? null
        : Map<String, dynamic>.from(token.claims!);
    yield MobileSession.fromClaims(user, claims);
  }
});
