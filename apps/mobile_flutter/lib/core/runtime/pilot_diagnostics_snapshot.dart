import '../models/mobile_models.dart';
import '../models/mobile_session.dart';
import '../sync/mobile_sync_coordinator.dart';
import 'app_runtime_info.dart';

class PilotDiagnosticsSnapshot {
  const PilotDiagnosticsSnapshot({
    required this.runtimeInfo,
    required this.shop,
    required this.session,
    required this.backendBaseUrl,
    required this.syncStatus,
    required this.historyOverview,
    required this.pendingOutboxCount,
    required this.domainStates,
    this.operatorEmailOverride,
    this.operatorRoleOverride,
    this.workspaceIdOverride,
    this.costVisibilityOverride,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final AppRuntimeInfo runtimeInfo;
  final ShopInfo shop;
  final MobileSession? session;
  final String backendBaseUrl;
  final MobileSyncStatus syncStatus;
  final HistoryOverview historyOverview;
  final int pendingOutboxCount;
  final List<DomainControlState> domainStates;
  final String? operatorEmailOverride;
  final String? operatorRoleOverride;
  final String? workspaceIdOverride;
  final bool? costVisibilityOverride;
  final DateTime generatedAt;

  bool get hasSignedInOperator =>
      (operatorEmailOverride?.trim().isNotEmpty == true) || session != null;

  String get operatorEmail {
    if (operatorEmailOverride?.trim().isNotEmpty == true) {
      return operatorEmailOverride!.trim();
    }
    if (session == null) {
      return 'Not signed in';
    }
    return session!.email.isNotEmpty ? session!.email : 'Unknown operator';
  }

  String get operatorRole =>
      operatorRoleOverride?.trim().isNotEmpty == true
      ? operatorRoleOverride!.trim().toUpperCase()
      : session?.role?.toUpperCase() ?? 'GUEST';

  String get workspaceId =>
      workspaceIdOverride?.trim().isNotEmpty == true
      ? workspaceIdOverride!.trim()
      : session?.shopId ?? 'No workspace bound';

  String get lastReceiptSyncLabel {
    final lastSyncedAt = historyOverview.lastSyncedAt;
    return lastSyncedAt == null
        ? 'Unknown'
        : lastSyncedAt.toUtc().toIso8601String();
  }

  String get primaryDomainCountLabel =>
      '${domainStates.where((state) => state.isPostgresPrimary).length}/${domainStates.length} primary';

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot launch snapshot',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'App: ${runtimeInfo.appName}',
      'Package: ${runtimeInfo.packageName}',
      'Version: ${runtimeInfo.versionLabel}',
      'Release fingerprint: ${runtimeInfo.releaseFingerprint}',
      'Workspace: ${shop.name}',
      'Workspace ID: $workspaceId',
      'Operator: $operatorEmail',
      'Operator role: $operatorRole',
      'Backend API: $backendBaseUrl',
      'Sync posture: ${syncStatus.name.toUpperCase()}',
      'Queued commerce commands: $pendingOutboxCount',
      'Queued receipt value: ${historyOverview.queuedRevenue.toStringAsFixed(2)}',
      'Failed receipts: ${historyOverview.failedSales}',
      'Last receipt sync (UTC): $lastReceiptSyncLabel',
      'Cost visibility: ${effectiveCostVisibility ? 'ENABLED' : 'RESTRICTED'}',
      'Domain posture: $primaryDomainCountLabel',
      'Domain states:',
    ];

    final sortedStates = List<DomainControlState>.of(domainStates)
      ..sort((left, right) => left.domain.compareTo(right.domain));

    if (sortedStates.isEmpty) {
      lines.add('- none recorded');
    } else {
      for (final state in sortedStates) {
        final action = state.pilotRecommendedAction?.trim();
        lines.add(
          '- ${state.domain}: ${state.postureLabel} | master=${state.writeMaster} | epoch=${state.currentEpoch}${action == null || action.isEmpty ? '' : ' | next=$action'}',
        );
      }
    }

    return lines.join('\n');
  }

  bool get effectiveCostVisibility =>
      costVisibilityOverride ?? (session?.canViewCost == true);
}
