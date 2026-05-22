import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/auth_gate_screen.dart';
import '../../features/customers/presentation/customers_screen.dart';
import '../../features/dashboard/presentation/dashboard_screen.dart';
import '../../features/history/presentation/history_screen.dart';
import '../../features/inventory/presentation/inventory_screen.dart';
import '../../features/pos/presentation/pos_screen.dart';
import '../../features/settings/presentation/settings_ops_screen.dart';
import '../../features/settings/presentation/settings_plan_screen.dart';
import '../../features/settings/presentation/settings_screen.dart';
import '../../features/shell/presentation/mobile_shell_screen.dart';

final GlobalKey<NavigatorState> appRootNavigatorKey =
    GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: appRootNavigatorKey,
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
                path: '/customers',
                builder: (context, state) => const CustomersScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: mobileShellBranchNavigatorKeys[3],
            routes: [
              GoRoute(
                path: '/history',
                builder: (context, state) => const HistoryScreen(),
              ),
            ],
          ),
          StatefulShellBranch(
            navigatorKey: mobileShellBranchNavigatorKeys[4],
            routes: [
              GoRoute(
                path: '/pos',
                builder: (context, state) => const PosScreen(),
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        parentNavigatorKey: appRootNavigatorKey,
        path: '/settings',
        pageBuilder: (context, state) =>
            const NoTransitionPage<void>(child: SettingsScreen()),
        routes: [
          GoRoute(
            parentNavigatorKey: appRootNavigatorKey,
            path: 'plan',
            pageBuilder: (context, state) =>
                const NoTransitionPage<void>(child: SettingsPlanScreen()),
          ),
          GoRoute(
            parentNavigatorKey: appRootNavigatorKey,
            path: 'advanced',
            pageBuilder: (context, state) =>
                const NoTransitionPage<void>(child: SettingsOpsScreen()),
          ),
        ],
      ),
      GoRoute(path: '/home', redirect: (context, state) => '/dashboard'),
    ],
  );
});
