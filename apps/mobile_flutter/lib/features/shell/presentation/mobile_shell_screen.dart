import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/database/mobile_repository.dart';
import '../../../core/models/mobile_models.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';

final List<GlobalKey<NavigatorState>> mobileShellBranchNavigatorKeys =
    List<GlobalKey<NavigatorState>>.generate(
      3,
      (_) => GlobalKey<NavigatorState>(),
    );

class MobileShellScreen extends ConsumerStatefulWidget {
  const MobileShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<MobileShellScreen> createState() => _MobileShellScreenState();
}

class _MobileShellScreenState extends ConsumerState<MobileShellScreen> {
  final List<int> _branchHistory = <int>[];

  bool get _canPopCurrentBranch {
    final navigator =
        mobileShellBranchNavigatorKeys[widget.navigationShell.currentIndex]
            .currentState;
    return navigator?.canPop() ?? false;
  }

  bool get _hasBackPath =>
      _canPopCurrentBranch ||
      _branchHistory.isNotEmpty ||
      widget.navigationShell.currentIndex != 0;

  Future<void> _handleBackNavigation() async {
    final navigator =
        mobileShellBranchNavigatorKeys[widget.navigationShell.currentIndex]
            .currentState;

    if (navigator?.canPop() ?? false) {
      navigator!.pop();
      return;
    }

    if (_branchHistory.isNotEmpty) {
      final previousIndex = _branchHistory.removeLast();
      if (mounted) {
        setState(() {});
      }
      widget.navigationShell.goBranch(previousIndex);
      return;
    }

    if (widget.navigationShell.currentIndex != 0) {
      widget.navigationShell.goBranch(0);
      if (mounted) {
        setState(() {});
      }
      return;
    }

    await SystemNavigator.pop();
  }

  void _goToBranch(int index) {
    final currentIndex = widget.navigationShell.currentIndex;
    if (index == currentIndex) {
      widget.navigationShell.goBranch(index, initialLocation: true);
      return;
    }

    setState(() {
      _branchHistory.removeWhere((entry) => entry == index);
      if (_branchHistory.isEmpty || _branchHistory.last != currentIndex) {
        _branchHistory.add(currentIndex);
      }
    });

    widget.navigationShell.goBranch(index);
  }

  Future<void> _signOut(BuildContext context) async {
    await FirebaseAuth.instance.signOut();
    if (context.mounted) {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopStream = ref.watch(shopRepositoryProvider).watchShopInfo();
    final syncStatus = ref.watch(syncStatusProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final navItem = _navItems[widget.navigationShell.currentIndex];

    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          await _handleBackNavigation();
        }
      },
      child: StreamBuilder<ShopInfo>(
        stream: shopStream,
        builder: (context, snapshot) {
          final shop = snapshot.data ?? ShopInfo.fallback();
          return Scaffold(
            backgroundColor: Colors.transparent,
            body: DecoratedBox(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: <Color>[
                    Color(0xFF05070B),
                    Color(0xFF0A1020),
                    Color(0xFF05070B),
                  ],
                ),
              ),
              child: Stack(
                children: <Widget>[
                  const _AmbientGlow(
                    alignment: Alignment.topLeft,
                    color: Color(0xFF2563EB),
                  ),
                  const _AmbientGlow(
                    alignment: Alignment.bottomRight,
                    color: Color(0xFF06B6D4),
                  ),
                  SafeArea(
                    child: Column(
                      children: <Widget>[
                        Padding(
                          padding: const EdgeInsets.fromLTRB(18, 18, 18, 10),
                          child: _ShellHeader(
                            title: navItem.title,
                            subtitle: navItem.subtitle,
                            workspaceName: shop.name,
                            workspaceTagline: shop.tagline,
                            syncStatus: syncStatus,
                            canGoBack: _hasBackPath,
                            onBackPressed: _handleBackNavigation,
                            onRefreshPressed: syncCoordinator.refresh,
                            onSignOutPressed: () => _signOut(context),
                          ),
                        ),
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: const Color(0xCC070B13),
                                borderRadius: BorderRadius.circular(30),
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.08),
                                ),
                                boxShadow: const <BoxShadow>[
                                  BoxShadow(
                                    color: Color(0x55000000),
                                    blurRadius: 36,
                                    offset: Offset(0, 18),
                                  ),
                                ],
                              ),
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(30),
                                child: widget.navigationShell,
                              ),
                            ),
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: const Color(0xE6111826),
                              borderRadius: BorderRadius.circular(28),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.08),
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 8,
                              ),
                              child: Row(
                                children: _navItems
                                    .asMap()
                                    .entries
                                    .map(
                                      (entry) => Expanded(
                                        child: _NavButton(
                                          item: entry.value,
                                          active:
                                              widget
                                                  .navigationShell
                                                  .currentIndex ==
                                              entry.key,
                                          onTap: () => _goToBranch(entry.key),
                                        ),
                                      ),
                                    )
                                    .toList(growable: false),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (syncStatus == MobileSyncStatus.syncing)
                    const Positioned(
                      top: 0,
                      left: 0,
                      right: 0,
                      child: LinearProgressIndicator(minHeight: 2),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ShellHeader extends StatelessWidget {
  const _ShellHeader({
    required this.title,
    required this.subtitle,
    required this.workspaceName,
    required this.workspaceTagline,
    required this.syncStatus,
    required this.canGoBack,
    required this.onBackPressed,
    required this.onRefreshPressed,
    required this.onSignOutPressed,
  });

  final String title;
  final String subtitle;
  final String workspaceName;
  final String workspaceTagline;
  final MobileSyncStatus syncStatus;
  final bool canGoBack;
  final VoidCallback onBackPressed;
  final Future<void> Function() onRefreshPressed;
  final VoidCallback onSignOutPressed;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final statusTone = switch (syncStatus) {
      MobileSyncStatus.syncing => const Color(0xFF38BDF8),
      MobileSyncStatus.error => const Color(0xFFFB7185),
      MobileSyncStatus.offline => const Color(0xFFF59E0B),
      MobileSyncStatus.idle => const Color(0xFF22C55E),
    };

    final statusLabel = switch (syncStatus) {
      MobileSyncStatus.syncing => 'Syncing',
      MobileSyncStatus.error => 'Attention',
      MobileSyncStatus.offline => 'Offline',
      MobileSyncStatus.idle => 'Live',
    };

    return Row(
      children: <Widget>[
        _HeaderIconButton(
          icon: canGoBack ? Icons.arrow_back_rounded : Icons.grid_view_rounded,
          onPressed: canGoBack ? onBackPressed : null,
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                title,
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: Colors.white.withValues(alpha: 0.62),
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: <Widget>[
                  Flexible(
                    child: Text(
                      workspaceName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: Colors.white.withValues(alpha: 0.84),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (workspaceTagline.isNotEmpty) ...<Widget>[
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        workspaceTagline,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: Colors.white.withValues(alpha: 0.46),
                          letterSpacing: 1.2,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 14),
        DecoratedBox(
          decoration: BoxDecoration(
            color: statusTone.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: statusTone.withValues(alpha: 0.22)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  statusLabel.toUpperCase(),
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: statusTone,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: statusTone,
                    shape: BoxShape.circle,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 10),
        _HeaderIconButton(
          icon: Icons.sync_rounded,
          onPressed: () {
            onRefreshPressed();
          },
        ),
        const SizedBox(width: 10),
        _HeaderIconButton(
          icon: Icons.logout_rounded,
          onPressed: onSignOutPressed,
        ),
      ],
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({required this.icon, this.onPressed});

  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 50,
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon),
        color: Colors.white,
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.active,
    required this.onTap,
  });

  final _ShellNavItem item;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(0xFF38BDF8) : Colors.white70;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Material(
        color: active ? const Color(0xFF0F1F38) : Colors.transparent,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(item.icon, color: color, size: 22),
                const SizedBox(height: 8),
                Text(
                  item.label,
                  style: TextStyle(
                    color: color,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AmbientGlow extends StatelessWidget {
  const _AmbientGlow({required this.alignment, required this.color});

  final Alignment alignment;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      child: IgnorePointer(
        child: Container(
          width: 180,
          height: 180,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: <Color>[
                color.withValues(alpha: 0.28),
                color.withValues(alpha: 0),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ShellNavItem {
  const _ShellNavItem({
    required this.label,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String label;
  final String title;
  final String subtitle;
  final IconData icon;
}

const List<_ShellNavItem> _navItems = <_ShellNavItem>[
  _ShellNavItem(
    label: 'Overview',
    title: 'Command Center',
    subtitle: 'Real-time pulse with faster local data opening first.',
    icon: Icons.grid_view_rounded,
  ),
  _ShellNavItem(
    label: 'Inventory',
    title: 'Inventory Deck',
    subtitle: 'Scroll-fast catalog, category filters, and stock health.',
    icon: Icons.inventory_2_rounded,
  ),
  _ShellNavItem(
    label: 'POS',
    title: 'Sales Hub',
    subtitle: 'Native checkout flow built for faster mobile billing.',
    icon: Icons.point_of_sale_rounded,
  ),
];
