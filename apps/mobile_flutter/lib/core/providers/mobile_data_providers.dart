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
