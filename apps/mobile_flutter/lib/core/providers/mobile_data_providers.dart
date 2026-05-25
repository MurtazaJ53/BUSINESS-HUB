import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../backend/backend_api_client.dart';
import '../models/mobile_models.dart';
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
