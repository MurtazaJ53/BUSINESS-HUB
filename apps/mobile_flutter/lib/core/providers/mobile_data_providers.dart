import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../backend/backend_api_client.dart';
import '../models/mobile_models.dart';
import '../models/mobile_session.dart';
import '../runtime/mobile_runtime_config.dart';
import '../session/mobile_session_controller.dart';

final shopInfoProvider = StreamProvider<ShopInfo>((ref) {
  final shopRepository = ref.watch(shopRepositoryProvider);
  return shopRepository.watchShopInfo();
});

final historyOverviewProvider = StreamProvider<HistoryOverview>((ref) {
  final salesRepository = ref.watch(salesRepositoryProvider);
  return salesRepository.watchHistoryOverview();
});

final pendingOutboxCountProvider = StreamProvider<int>((ref) {
  final salesRepository = ref.watch(salesRepositoryProvider);
  return salesRepository.watchPendingOutboxCount();
});

final customersProvider = StreamProvider<List<BackendCustomerSummary>>((ref) {
  final customerRepository = ref.watch(customerRepositoryProvider);
  return customerRepository.watchLegacyCustomers();
});

final mobileMfaVerifiedUntilProvider = StreamProvider<DateTime?>((ref) {
  final shopRepository = ref.watch(shopRepositoryProvider);
  return shopRepository.watchMfaVerifiedUntil();
});

final shopMembershipsProvider =
    FutureProvider<List<ShopMembershipAccessRecord>>((ref) async {
      final session = await ref.watch(mobileSessionProvider.future);
      if (session == null) {
        return const <ShopMembershipAccessRecord>[];
      }
      if (!MobileRuntimeConfig.backendSyncEnabled) {
        return _localMemberships(session);
      }

      return ref
          .read(backendApiClientProvider)
          .getShopMemberships(user: session.user);
    });

final workspacePulseProvider = FutureProvider<WorkspacePulseSnapshot?>((
  ref,
) async {
  final session = await ref.watch(mobileSessionProvider.future);
  if (session == null || !session.isOwnerLike || !session.hasShop) {
    return null;
  }
  if (!MobileRuntimeConfig.backendSyncEnabled) {
    return _localPulseSnapshot();
  }

  return ref
      .read(backendApiClientProvider)
      .getWorkspacePulse(user: session.user, shopId: session.shopId!);
});

final workspacePulseSignalsProvider =
    FutureProvider<List<WorkspacePulseSignal>>((ref) async {
      final session = await ref.watch(mobileSessionProvider.future);
      if (session == null || !session.isOwnerLike || !session.hasShop) {
        return const <WorkspacePulseSignal>[];
      }
      if (!MobileRuntimeConfig.backendSyncEnabled) {
        return const <WorkspacePulseSignal>[];
      }

      return ref
          .read(backendApiClientProvider)
          .getWorkspacePulseSignals(
            user: session.user,
            shopId: session.shopId!,
          );
    });

final workspaceAccessSessionsProvider =
    FutureProvider<List<WorkspaceAccessSessionRecord>>((ref) async {
      final session = await ref.watch(mobileSessionProvider.future);
      if (session == null || !session.isOwnerLike || !session.hasShop) {
        return const <WorkspaceAccessSessionRecord>[];
      }
      if (!MobileRuntimeConfig.backendSyncEnabled) {
        return _localAccessSessions(session);
      }

      return ref
          .read(backendApiClientProvider)
          .getWorkspaceAccessSessions(
            user: session.user,
            shopId: session.shopId!,
          );
    });

final workspaceTeamMembersProvider =
    FutureProvider<List<WorkspaceTeamMemberRecord>>((ref) async {
      final session = await ref.watch(mobileSessionProvider.future);
      if (session == null || !session.isOwnerLike || !session.hasShop) {
        return const <WorkspaceTeamMemberRecord>[];
      }
      if (!MobileRuntimeConfig.backendSyncEnabled) {
        return _localTeamMembers(session);
      }

      return ref
          .read(backendApiClientProvider)
          .getWorkspaceTeamMembers(user: session.user, shopId: session.shopId!);
    });

final attendanceSummaryProvider = FutureProvider<AttendanceSummarySnapshot?>((
  ref,
) async {
  final session = await ref.watch(mobileSessionProvider.future);
  final memberships = await ref.watch(shopMembershipsProvider.future);
  if (session == null || !session.hasShop) {
    return null;
  }
  if (!MobileRuntimeConfig.backendSyncEnabled) {
    return const AttendanceSummarySnapshot(
      totalSessions: 0,
      presentCount: 0,
      leaveCount: 0,
      activeWorkersToday: 0,
    );
  }

  final scopedMembershipId = session.isOwnerLike
      ? null
      : memberships
            .where((item) => item.shopId == session.shopId && item.isActive)
            .map((item) => item.id)
            .cast<String?>()
            .firstWhere(
              (item) => item != null && item.isNotEmpty,
              orElse: () => session.membershipId,
            );
  return ref
      .read(backendApiClientProvider)
      .getAttendanceSummary(
        user: session.user,
        shopId: session.shopId!,
        membershipId: scopedMembershipId,
      );
});

final attendanceSessionsProvider =
    FutureProvider<List<AttendanceSessionRecord>>((ref) async {
      final session = await ref.watch(mobileSessionProvider.future);
      final memberships = await ref.watch(shopMembershipsProvider.future);
      if (session == null || !session.hasShop) {
        return const <AttendanceSessionRecord>[];
      }
      if (!MobileRuntimeConfig.backendSyncEnabled) {
        return const <AttendanceSessionRecord>[];
      }

      final scopedMembershipId = session.isOwnerLike
          ? null
          : memberships
                .where((item) => item.shopId == session.shopId && item.isActive)
                .map((item) => item.id)
                .cast<String?>()
                .firstWhere(
                  (item) => item != null && item.isNotEmpty,
                  orElse: () => session.membershipId,
                );
      return ref
          .read(backendApiClientProvider)
          .getAttendanceSessions(
            user: session.user,
            shopId: session.shopId!,
            membershipId: scopedMembershipId,
          );
    });

final expenseSummaryProvider = FutureProvider<ExpenseSummarySnapshot?>((
  ref,
) async {
  final session = await ref.watch(mobileSessionProvider.future);
  if (session == null || !session.hasShop) {
    return null;
  }
  if (!MobileRuntimeConfig.backendSyncEnabled) {
    return const ExpenseSummarySnapshot(
      totalEntries: 0,
      totalAmount: 0,
      uniqueCategories: 0,
      biggestCategory: null,
    );
  }

  return ref
      .read(backendApiClientProvider)
      .getExpenseSummary(user: session.user, shopId: session.shopId!);
});

final expensesProvider = FutureProvider<List<ExpenseRecord>>((ref) async {
  final session = await ref.watch(mobileSessionProvider.future);
  if (session == null || !session.hasShop) {
    return const <ExpenseRecord>[];
  }
  if (!MobileRuntimeConfig.backendSyncEnabled) {
    return const <ExpenseRecord>[];
  }

  return ref
      .read(backendApiClientProvider)
      .getExpenses(user: session.user, shopId: session.shopId!);
});

final dashboardOverviewProvider =
    StreamProvider.family<DashboardOverview, bool>((ref, includeCost) {
      final inventoryRepository = ref.watch(inventoryRepositoryProvider);
      return inventoryRepository.watchDashboardOverview(
        includeCost: includeCost,
      );
    });

final dashboardLowStockPreviewProvider = StreamProvider<List<LowStockItem>>((
  ref,
) {
  final inventoryRepository = ref.watch(inventoryRepositoryProvider);
  return inventoryRepository.watchLowStockPreview();
});

final dashboardRecentSalesProvider = StreamProvider<List<RecentSaleSummary>>((
  ref,
) {
  final salesRepository = ref.watch(salesRepositoryProvider);
  return salesRepository.watchRecentSales(limit: 4);
});

final historySalesProvider =
    StreamProvider.family<List<RecentSaleSummary>, HistoryFilter>((
      ref,
      filter,
    ) {
      final salesRepository = ref.watch(salesRepositoryProvider);
      return salesRepository.watchRecentSales(filter: filter);
    });

final historyDomainStatesProvider = StreamProvider<List<DomainControlState>>((
  ref,
) {
  final shopRepository = ref.watch(shopRepositoryProvider);
  return shopRepository.watchTrackedDomainStates(const <String>[
    'sales',
    'payments',
  ]);
});

final settingsOpsDomainStatesProvider =
    StreamProvider<List<DomainControlState>>((ref) {
      final shopRepository = ref.watch(shopRepositoryProvider);
      return shopRepository.watchTrackedDomainStates(const <String>[
        'inventory',
        'customers',
        'sales',
        'payments',
      ]);
    });

List<ShopMembershipAccessRecord> _localMemberships(MobileSession session) {
  return <ShopMembershipAccessRecord>[
    ShopMembershipAccessRecord(
      id: session.membershipId ?? 'local-owner-membership',
      role: session.normalizedRole.isEmpty ? 'owner' : session.normalizedRole,
      roleLabel: session.displayRoleLabel,
      roleSummary: session.roleSummary,
      roleProfile: session.roleProfileKey,
      status: 'active',
      shopId: session.shopId ?? MobileRuntimeConfig.localShopId,
      shopName: MobileRuntimeConfig.localShopName,
      shopSlug: 'local-business-hub',
      shopCurrencyCode: 'INR',
      shopTimezone: 'Asia/Kolkata',
      shopPlanTier: 'growth',
      shopEnabledFeatures: const <String, bool>{
        'inventory': true,
        'pos': true,
        'customers': true,
        'history': true,
        'team': true,
        'attendance': true,
        'expenses': true,
        'advanced_ops': true,
      },
    ),
  ];
}

List<WorkspaceTeamMemberRecord> _localTeamMembers(MobileSession session) {
  final now = DateTime.now();
  return <WorkspaceTeamMemberRecord>[
    WorkspaceTeamMemberRecord(
      id: session.membershipId ?? 'local-owner-membership',
      memberName: session.user.displayName.isEmpty
          ? 'Business Hub Owner'
          : session.user.displayName,
      memberEmail: session.email,
      phone: '',
      role: session.normalizedRole.isEmpty ? 'owner' : session.normalizedRole,
      roleLabel: session.displayRoleLabel,
      roleSummary: session.roleSummary,
      roleProfile: session.roleProfileKey,
      status: 'active',
      permissionsVersion: 1,
      permissions: session.permissions ?? const <String, dynamic>{},
      isCurrentUser: true,
      canManage: true,
      createdAt: now,
      updatedAt: now,
    ),
  ];
}

List<WorkspaceAccessSessionRecord> _localAccessSessions(MobileSession session) {
  final now = DateTime.now();
  return <WorkspaceAccessSessionRecord>[
    WorkspaceAccessSessionRecord(
      id: 'local-device-session',
      memberName: session.user.displayName.isEmpty
          ? 'Business Hub Owner'
          : session.user.displayName,
      memberEmail: session.email,
      membershipRoleSnapshot: session.normalizedRole.isEmpty
          ? 'owner'
          : session.normalizedRole,
      roleLabel: session.displayRoleLabel,
      status: 'active',
      deviceLabel: 'Local device',
      platformName: 'android',
      packageName: 'business_hub_mobile',
      appVersion: 'local',
      buildNumber: 'local',
      releaseChannel: 'local-first',
      releaseTag: 'local-first',
      lastSeenAt: now,
      revokedAt: null,
      revokeReason: null,
      wipeRequested: false,
      wipeRequestedAt: null,
      wipeAcknowledgedAt: null,
      trustScore: 100,
      trustLevel: 'trusted',
      trustSummary: 'Local owner session. Backend session governance is off.',
      trustReasons: const <String>['Local-first build'],
      metadata: const <String, dynamic>{'mode': 'local_first'},
      canManage: true,
      createdAt: now,
      updatedAt: now,
    ),
  ];
}

WorkspacePulseSnapshot _localPulseSnapshot() {
  return WorkspacePulseSnapshot(
    refreshedAt: DateTime.now(),
    headline: const WorkspacePulseHeadline(
      title: 'Local workspace is ready',
      body:
          'Inventory, POS, customers, and history run from the device vault. Live backend sync is paused for this build.',
      route: '/inventory',
      ctaLabel: 'Open inventory',
      tone: 'success',
    ),
    stats: const WorkspacePulseStats(
      openTaskCount: 0,
      criticalAnomalyCount: 0,
      warningAnomalyCount: 0,
      staleSessionCount: 0,
      wipePendingCount: 0,
      openPlanRequestCount: 0,
      lowStockCount: 0,
    ),
    tasks: const <WorkspacePulseTask>[],
    anomalies: const <WorkspacePulseAnomaly>[],
  );
}

final outboxAttentionEntriesProvider =
    StreamProvider<List<CommerceOutboxAttentionEntry>>((ref) {
      final salesRepository = ref.watch(salesRepositoryProvider);
      return salesRepository.watchOutboxAttentionEntries();
    });

final domainStateProvider = StreamProvider.family<DomainControlState, String>((
  ref,
  domain,
) {
  final shopRepository = ref.watch(shopRepositoryProvider);
  return shopRepository.watchDomainState(domain);
});

final inventoryCategoriesProvider =
    StreamProvider<List<InventoryCategorySummary>>((ref) {
      final inventoryRepository = ref.watch(inventoryRepositoryProvider);
      return inventoryRepository.watchCategories();
    });

final inventoryOverviewProvider =
    StreamProvider.family<DashboardOverview, bool>((ref, includeCost) {
      final inventoryRepository = ref.watch(inventoryRepositoryProvider);
      return inventoryRepository.watchDashboardOverview(
        includeCost: includeCost,
      );
    });

final inventoryCatalogPageProvider =
    StreamProvider.family<List<InventoryCatalogItem>, InventoryCatalogFilter>((
      ref,
      filter,
    ) {
      final inventoryRepository = ref.watch(inventoryRepositoryProvider);
      return inventoryRepository.watchCatalogPage(
        search: filter.search,
        category: filter.category,
        page: filter.page,
        pageSize: filter.pageSize,
        includeCost: filter.includeCost,
        lowStockOnly: filter.lowStockOnly,
      );
    });

final inventoryCatalogCountProvider =
    StreamProvider.family<int, InventoryCatalogFilter>((ref, filter) {
      final inventoryRepository = ref.watch(inventoryRepositoryProvider);
      return inventoryRepository.watchCatalogCount(
        search: filter.search,
        category: filter.category,
        lowStockOnly: filter.lowStockOnly,
      );
    });

final posCatalogPageProvider =
    StreamProvider.family<List<InventoryCatalogItem>, PosCatalogFilter>((
      ref,
      filter,
    ) {
      final inventoryRepository = ref.watch(inventoryRepositoryProvider);
      return inventoryRepository.watchCatalogPage(
        search: filter.search,
        category: filter.category,
        page: filter.page,
        pageSize: filter.pageSize,
        includeCost: filter.includeCost,
        lowStockOnly: filter.lowStockOnly,
      );
    });

final posCatalogCountProvider = StreamProvider.family<int, PosCatalogFilter>((
  ref,
  filter,
) {
  final inventoryRepository = ref.watch(inventoryRepositoryProvider);
  return inventoryRepository.watchCatalogCount(
    search: filter.search,
    category: filter.category,
    lowStockOnly: filter.lowStockOnly,
  );
});
