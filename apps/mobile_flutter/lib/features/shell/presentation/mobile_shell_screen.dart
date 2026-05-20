import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/models/mobile_models.dart';
import '../../../core/models/mobile_session.dart';
import '../../../core/providers/mobile_data_providers.dart';
import '../../../core/session/mobile_session_controller.dart';
import '../../../core/sync/mobile_sync_coordinator.dart';

final List<GlobalKey<NavigatorState>> mobileShellBranchNavigatorKeys =
    List<GlobalKey<NavigatorState>>.generate(
      5,
      (_) => GlobalKey<NavigatorState>(),
    );

class MobileShellScreen extends ConsumerStatefulWidget {
  const MobileShellScreen({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<MobileShellScreen> createState() => _MobileShellScreenState();
}

class _MobileShellScreenState extends ConsumerState<MobileShellScreen> {
  bool get _canPopCurrentBranch {
    final navigator =
        mobileShellBranchNavigatorKeys[widget.navigationShell.currentIndex]
            .currentState;
    return navigator?.canPop() ?? false;
  }

  bool _hasBackPath(int primaryBranchIndex) =>
      _canPopCurrentBranch ||
      widget.navigationShell.currentIndex != primaryBranchIndex;

  Future<void> _handleBackNavigation(int primaryBranchIndex) async {
    final navigator =
        mobileShellBranchNavigatorKeys[widget.navigationShell.currentIndex]
            .currentState;

    if (navigator?.canPop() ?? false) {
      navigator!.pop();
      return;
    }

    if (widget.navigationShell.currentIndex != primaryBranchIndex) {
      widget.navigationShell.goBranch(primaryBranchIndex);
      return;
    }

    await SystemNavigator.pop();
  }

  void _goToBranch(int branchIndex) {
    final currentIndex = widget.navigationShell.currentIndex;
    if (branchIndex == currentIndex) {
      widget.navigationShell.goBranch(branchIndex, initialLocation: true);
      return;
    }

    widget.navigationShell.goBranch(branchIndex);
  }

  void _openSettings() {
    context.push('/settings');
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(mobileSessionProvider).asData?.value;
    final shop =
        ref.watch(shopInfoProvider).asData?.value ?? ShopInfo.fallback();
    final syncStatus = ref.watch(syncStatusProvider);
    final syncCoordinator = ref.watch(mobileSyncCoordinatorProvider);
    final navProfile = _ShellNavigationProfile.forSession(session);
    final navItem = navProfile.itemForBranch(
      widget.navigationShell.currentIndex,
    );
    final mediaSize = MediaQuery.sizeOf(context);
    final compactChrome = mediaSize.width < 430 || mediaSize.height < 780;
    final horizontalInset = compactChrome ? 12.0 : 14.0;

    return PopScope<Object?>(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop) {
          await _handleBackNavigation(navProfile.primaryBranchIndex);
        }
      },
      child: Scaffold(
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
              if (!compactChrome) ...const <Widget>[
                _AmbientGlow(
                  alignment: Alignment.topLeft,
                  color: Color(0xFF2563EB),
                ),
                _AmbientGlow(
                  alignment: Alignment.bottomRight,
                  color: Color(0xFF06B6D4),
                ),
              ],
              SafeArea(
                child: Column(
                  children: <Widget>[
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        compactChrome ? 14 : 18,
                        compactChrome ? 14 : 18,
                        compactChrome ? 14 : 18,
                        compactChrome ? 8 : 10,
                      ),
                      child: _ShellHeader(
                        title: navItem.title,
                        workspaceName: shop.name,
                        roleLabel: session?.displayRoleLabel ?? 'GUEST',
                        compact: compactChrome,
                        syncStatus: syncStatus,
                        canGoBack: _hasBackPath(navProfile.primaryBranchIndex),
                        onBackPressed: () =>
                            _handleBackNavigation(navProfile.primaryBranchIndex),
                        onSettingsPressed: _openSettings,
                        onRefreshPressed: syncCoordinator.refresh,
                      ),
                    ),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: horizontalInset,
                        ),
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            color: const Color(0xC4070B13),
                            borderRadius: BorderRadius.circular(
                              compactChrome ? 24 : 30,
                            ),
                            border: Border.all(
                              color: Colors.white.withValues(
                                alpha: compactChrome ? 0.05 : 0.08,
                              ),
                            ),
                            boxShadow: compactChrome
                                ? const <BoxShadow>[]
                                : const <BoxShadow>[
                                    BoxShadow(
                                      color: Color(0x42000000),
                                      blurRadius: 28,
                                      offset: Offset(0, 14),
                                    ),
                                  ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(
                              compactChrome ? 24 : 30,
                            ),
                            child: widget.navigationShell,
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        horizontalInset,
                        compactChrome ? 10 : 12,
                        horizontalInset,
                        compactChrome ? 12 : 16,
                      ),
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: const Color(0xE6111826),
                          borderRadius: BorderRadius.circular(
                            compactChrome ? 24 : 28,
                          ),
                          border: Border.all(
                            color: Colors.white.withValues(
                              alpha: compactChrome ? 0.05 : 0.08,
                            ),
                          ),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: compactChrome ? 4 : 8,
                            vertical: compactChrome ? 6 : 8,
                          ),
                          child: Row(
                            children: navProfile.items
                                .map(
                                  (entry) => Expanded(
                                    child: _NavButton(
                                      item: entry.item,
                                      active:
                                          widget.navigationShell.currentIndex ==
                                          entry.branchIndex,
                                      compact: compactChrome,
                                      onTap: () =>
                                          _goToBranch(entry.branchIndex),
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
      ),
    );
  }
}

class _ShellHeader extends StatelessWidget {
  const _ShellHeader({
    required this.title,
    required this.workspaceName,
    required this.roleLabel,
    required this.compact,
    required this.syncStatus,
    required this.canGoBack,
    required this.onBackPressed,
    required this.onSettingsPressed,
    required this.onRefreshPressed,
  });

  final String title;
  final String workspaceName;
  final String roleLabel;
  final bool compact;
  final MobileSyncStatus syncStatus;
  final bool canGoBack;
  final VoidCallback onBackPressed;
  final VoidCallback onSettingsPressed;
  final Future<void> Function() onRefreshPressed;

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
    final chipLabel = compact
        ? switch (syncStatus) {
            MobileSyncStatus.syncing => 'SYNC',
            MobileSyncStatus.error => 'ALERT',
            MobileSyncStatus.offline => 'OFFLINE',
            MobileSyncStatus.idle => 'LIVE',
          }
        : statusLabel.toUpperCase();

    return DecoratedBox(
      decoration: BoxDecoration(
        color: const Color(0xE6111826),
        borderRadius: BorderRadius.circular(compact ? 22 : 24),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 12 : 14,
          vertical: compact ? 10 : 12,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: <Widget>[
            _HeaderIconButton(
              compact: compact,
              icon: canGoBack ? Icons.arrow_back_rounded : Icons.tune_rounded,
              onPressed: canGoBack ? onBackPressed : onSettingsPressed,
            ),
            SizedBox(width: compact ? 10 : 12),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$workspaceName • $roleLabel',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.58),
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(width: compact ? 8 : 10),
            _StatusSignalChip(
              compact: compact,
              tone: statusTone,
              label: chipLabel,
            ),
            SizedBox(width: compact ? 8 : 10),
            _HeaderIconButton(
              compact: compact,
              icon: Icons.sync_rounded,
              onPressed: () {
                onRefreshPressed();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.icon,
    required this.compact,
    this.onPressed,
  });

  final IconData icon;
  final bool compact;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: compact ? 44 : 50,
      height: compact ? 44 : 50,
      decoration: BoxDecoration(
        color: const Color(0xFF111827),
        borderRadius: BorderRadius.circular(compact ? 15 : 18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: IconButton(
        onPressed: onPressed,
        icon: Icon(icon, size: compact ? 20 : 24),
        color: Colors.white,
        padding: EdgeInsets.zero,
      ),
    );
  }
}

class _StatusSignalChip extends StatelessWidget {
  const _StatusSignalChip({
    required this.tone,
    required this.label,
    required this.compact,
  });

  final Color tone;
  final String label;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(compact ? 16 : 18),
        border: Border.all(color: tone.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: compact ? 10 : 14,
          vertical: compact ? 8 : 10,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
              width: compact ? 8 : 9,
              height: compact ? 8 : 9,
              decoration: BoxDecoration(color: tone, shape: BoxShape.circle),
            ),
            SizedBox(width: compact ? 6 : 8),
            Text(
              label,
              style: TextStyle(
                color: tone,
                fontWeight: FontWeight.w900,
                letterSpacing: compact ? 0.9 : 1.2,
                fontSize: compact ? 10 : 11,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavButton extends StatelessWidget {
  const _NavButton({
    required this.item,
    required this.active,
    required this.compact,
    required this.onTap,
  });

  final _ShellNavItem item;
  final bool active;
  final bool compact;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? const Color(0xFF38BDF8) : Colors.white70;
    final label = compact ? item.compactLabel : item.label;
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: compact ? 2 : 4),
      child: Material(
        color: active ? const Color(0xFF0F1F38) : Colors.transparent,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(22),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: compact ? 4 : 8,
              vertical: compact ? 10 : 12,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(item.icon, color: color, size: compact ? 20 : 22),
                SizedBox(height: compact ? 6 : 8),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  softWrap: false,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: color,
                    fontSize: compact ? 10 : 11,
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

class _ShellNavigationProfile {
  const _ShellNavigationProfile({
    required this.primaryBranchIndex,
    required this.items,
  });

  final int primaryBranchIndex;
  final List<_VisibleShellNavItem> items;

  factory _ShellNavigationProfile.forSession(MobileSession? session) {
    if (session?.landsOnPosByDefault ?? false) {
      return const _ShellNavigationProfile(
        primaryBranchIndex: 4,
        items: _cashierNavItems,
      );
    }

    return const _ShellNavigationProfile(
      primaryBranchIndex: 0,
      items: _defaultNavItems,
    );
  }

  _ShellNavItem itemForBranch(int branchIndex) {
    for (final entry in items) {
      if (entry.branchIndex == branchIndex) {
        return entry.item;
      }
    }

    return _defaultNavItems
        .firstWhere((entry) => entry.branchIndex == branchIndex)
        .item;
  }
}

class _VisibleShellNavItem {
  const _VisibleShellNavItem({
    required this.branchIndex,
    required this.item,
  });

  final int branchIndex;
  final _ShellNavItem item;
}

class _ShellNavItem {
  const _ShellNavItem({
    required this.label,
    required this.compactLabel,
    required this.title,
    required this.subtitle,
    required this.icon,
  });

  final String label;
  final String compactLabel;
  final String title;
  final String subtitle;
  final IconData icon;
}

const List<_VisibleShellNavItem> _defaultNavItems = <_VisibleShellNavItem>[
  _VisibleShellNavItem(branchIndex: 0, item: _dashboardNavItem),
  _VisibleShellNavItem(branchIndex: 1, item: _inventoryNavItem),
  _VisibleShellNavItem(branchIndex: 2, item: _customersNavItem),
  _VisibleShellNavItem(branchIndex: 3, item: _historyNavItem),
  _VisibleShellNavItem(branchIndex: 4, item: _posNavItem),
];

const List<_VisibleShellNavItem> _cashierNavItems = <_VisibleShellNavItem>[
  _VisibleShellNavItem(branchIndex: 4, item: _posNavItem),
  _VisibleShellNavItem(branchIndex: 1, item: _inventoryNavItem),
  _VisibleShellNavItem(branchIndex: 2, item: _customersNavItem),
  _VisibleShellNavItem(branchIndex: 3, item: _historyNavItem),
  _VisibleShellNavItem(branchIndex: 0, item: _dashboardNavItem),
];

const _ShellNavItem _dashboardNavItem = _ShellNavItem(
  label: 'Overview',
  compactLabel: 'Home',
  title: 'Home',
  subtitle: 'Real-time metrics, live sync, and premium mobile control.',
  icon: Icons.grid_view_rounded,
);

const _ShellNavItem _inventoryNavItem = _ShellNavItem(
  label: 'Inventory',
  compactLabel: 'Stock',
  title: 'Inventory',
  subtitle: 'Scroll-fast catalog, category filters, and stock watch.',
  icon: Icons.inventory_2_rounded,
);

const _ShellNavItem _customersNavItem = _ShellNavItem(
  label: 'Clients',
  compactLabel: 'Clients',
  title: 'Customers',
  subtitle: 'Known buyers, loyalty pulse, and ledger-aware recovery.',
  icon: Icons.groups_rounded,
);

const _ShellNavItem _historyNavItem = _ShellNavItem(
  label: 'History',
  compactLabel: 'History',
  title: 'History',
  subtitle: 'Recent receipts, queue health, and replay confidence.',
  icon: Icons.receipt_long_rounded,
);

const _ShellNavItem _posNavItem = _ShellNavItem(
  label: 'POS',
  compactLabel: 'POS',
  title: 'POS',
  subtitle: 'Native checkout flow built for faster, smoother billing.',
  icon: Icons.point_of_sale_rounded,
);
