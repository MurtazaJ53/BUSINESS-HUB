import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/runtime/app_runtime_info.dart';
import 'package:business_hub_mobile/core/runtime/pilot_diagnostics_snapshot.dart';
import 'package:business_hub_mobile/core/runtime/pilot_readiness_report.dart';
import 'package:business_hub_mobile/core/sync/mobile_sync_coordinator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('readiness becomes blocked when build is local and failures exist', () {
    const runtime = AppRuntimeInfo(
      appName: 'Business Hub',
      packageName: 'com.example.businesshub',
      version: '1.3.9',
      buildNumber: '9',
      releaseChannel: 'local',
      releaseSha: '',
      releaseTag: 'dev-build',
      pilotScope: 'unspecified',
    );

    final diagnostics = PilotDiagnosticsSnapshot(
      runtimeInfo: runtime,
      shop: const ShopInfo(
        name: 'Pilot Shop',
        tagline: 'Fast retail',
        footer: 'Thanks',
        currency: 'INR',
        phone: '',
      ),
      session: null,
      backendBaseUrl: 'https://api.business-hub.test/api/v1',
      syncStatus: MobileSyncStatus.error,
      historyOverview: const HistoryOverview(
        totalSales: 10,
        syncedSales: 8,
        queuedSales: 1,
        failedSales: 1,
        totalRevenue: 10000,
        queuedRevenue: 500,
        lastSyncedAt: null,
      ),
      pendingOutboxCount: 1,
      domainStates: <DomainControlState>[
        DomainControlState.legacy('sales'),
      ],
    );

    final report = PilotReadinessReport.evaluate(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[
        CommerceOutboxAttentionEntry(
          commandId: 'sale-cmd-1',
          commandType: 'sale_create',
          syncStatus: 'failed',
          attemptCount: 3,
          updatedAt: 1,
        ),
      ],
    );

    expect(report.isBlocked, isTrue);
    expect(report.blockers, isNotEmpty);
    expect(report.statusLabel, 'BLOCKED STARTUP');
    expect(
      report.toMultilineText(),
      contains('This build is still marked as local'),
    );
  });

  test('readiness becomes monitor state for queued or offline posture', () {
    const runtime = AppRuntimeInfo(
      appName: 'Business Hub',
      packageName: 'com.example.businesshub',
      version: '1.3.9',
      buildNumber: '9',
      releaseChannel: 'pilot',
      releaseSha: 'abc1234',
      releaseTag: 'mobile-v1.3.9',
      pilotScope: 'limbdi-wave-1',
    );

    final diagnostics = PilotDiagnosticsSnapshot(
      runtimeInfo: runtime,
      shop: const ShopInfo(
        name: 'Pilot Shop',
        tagline: 'Fast retail',
        footer: 'Thanks',
        currency: 'INR',
        phone: '',
      ),
      session: null,
      backendBaseUrl: 'https://api.business-hub.test/api/v1',
      syncStatus: MobileSyncStatus.offline,
      historyOverview: const HistoryOverview(
        totalSales: 10,
        syncedSales: 10,
        queuedSales: 0,
        failedSales: 0,
        totalRevenue: 10000,
        queuedRevenue: 0,
        lastSyncedAt: null,
      ),
      operatorEmailOverride: 'pilot@shop.test',
      operatorRoleOverride: 'staff',
      workspaceIdOverride: 'shop-pilot-1',
      pendingOutboxCount: 1,
      domainStates: const <DomainControlState>[],
    );

    final report = PilotReadinessReport.evaluate(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[],
    );

    expect(report.shouldMonitor, isTrue);
    expect(report.warnings, isNotEmpty);
    expect(report.statusLabel, 'MONITOR BEFORE SHIFT');
  });
}
