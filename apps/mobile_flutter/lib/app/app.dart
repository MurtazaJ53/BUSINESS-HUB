import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/database/local_database.dart';
import '../core/router/app_router.dart';
import '../core/sync/mobile_sync_coordinator.dart';
import '../core/theme/app_theme.dart';

class BusinessHubMobileApp extends ConsumerWidget {
  const BusinessHubMobileApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(localDatabaseProvider);
    ref.watch(mobileSyncCoordinatorProvider);
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Business Hub Mobile',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      routerConfig: router,
    );
  }
}
