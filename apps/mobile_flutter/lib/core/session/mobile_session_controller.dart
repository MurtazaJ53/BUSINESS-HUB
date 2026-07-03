import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../models/mobile_session.dart';
import '../runtime/mobile_runtime_config.dart';

class MobileSessionNotifier extends AsyncNotifier<MobileSession?> {
  @override
  Future<MobileSession?> build() async {
    // Start unauthenticated
    return null;
  }

  Future<void> login(String pinOrEmail) async {
    state = const AsyncValue.loading();
    
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 600));
    
    final session = MobileSession.localOwner();
    await ref.read(shopRepositoryProvider).saveShopDocument(<String, dynamic>{
      'name': MobileRuntimeConfig.localShopName,
      'tagline': 'LOCAL-FIRST COMMAND CENTER',
      'footer': 'Thank you for your business!',
      'currency': 'USD',
      'plan_tier': 'growth',
      'enabled_features': <String, bool>{
        'inventory': true,
        'pos': true,
        'customers': true,
        'history': true,
        'team': true,
        'attendance': true,
        'expenses': true,
        'advanced_ops': true,
      },
    });
    
    state = AsyncValue.data(session);
  }

  void logout() {
    state = const AsyncValue.data(null);
  }
}

final mobileSessionProvider = AsyncNotifierProvider<MobileSessionNotifier, MobileSession?>(() {
  return MobileSessionNotifier();
});
