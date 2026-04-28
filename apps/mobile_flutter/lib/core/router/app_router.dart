import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_gate_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/inventory/presentation/inventory_screen.dart';
import '../../features/pos/presentation/pos_screen.dart';
import '../../features/shell/presentation/mobile_shell_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const AuthGateScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MobileShellScreen(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(
            navigatorKey: mobileShellBranchNavigatorKeys[0],
            routes: [
              GoRoute(
                path: '/dashboard',
                builder: (context, state) => const DashboardScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: mobileShellBranchNavigatorKeys[1],
            routes: [
              GoRoute(
                path: '/inventory',
                builder: (context, state) => const InventoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: mobileShellBranchNavigatorKeys[2],
            routes: [
              GoRoute(
                path: '/pos',
                builder: (context, state) => const PosScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(path: '/home', redirect: (context, state) => '/dashboard'),
    ],
  );
});
