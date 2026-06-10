import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../models/mobile_session.dart';
import '../runtime/mobile_runtime_config.dart';

final mobileSessionProvider = StreamProvider<MobileSession?>((ref) async* {
  final session = MobileSession.localOwner();
  await ref.read(shopRepositoryProvider).saveShopDocument(<String, dynamic>{
    'name': MobileRuntimeConfig.localShopName,
    'tagline': 'LOCAL-FIRST COMMAND CENTER',
    'footer': 'Thank you for your business!',
    'currency': 'INR',
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
  yield session;
});
