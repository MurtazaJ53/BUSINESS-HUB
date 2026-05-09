import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import '../models/mobile_models.dart';

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
