import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/runtime/app_runtime_info.dart';
import 'package:business_hub_mobile/core/runtime/pilot_diagnostics_snapshot.dart';
import 'package:business_hub_mobile/core/runtime/pilot_handoff_report.dart';
import 'package:business_hub_mobile/core/runtime/pilot_readiness_report.dart';
import 'package:business_hub_mobile/core/runtime/pilot_recovery_report.dart';
import 'package:business_hub_mobile/core/sync/mobile_sync_coordinator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('handoff pack contains readiness, snapshot, and recovery sections', () {
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
      generatedAt: DateTime.utc(2026, 5, 2, 18, 0),
    );

    final readiness = PilotReadinessReport.evaluate(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[],
    );
    final recovery = PilotRecoveryReport(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[],
      generatedAt: DateTime.utc(2026, 5, 2, 18, 5),
    );

    final handoff = PilotHandoffReport(
      diagnosticsSnapshot: diagnostics,
      readinessReport: readiness,
      recoveryReport: recovery,
      generatedAt: DateTime.utc(2026, 5, 2, 18, 10),
    );

    final text = handoff.toMultilineText();

    expect(text, contains('Business Hub pilot handoff pack'));
    expect(text, contains('=== READINESS SIGNOFF ==='));
    expect(text, contains('=== LAUNCH SNAPSHOT ==='));
    expect(text, contains('=== RECOVERY REPORT ==='));
    expect(text, contains('Status: MONITOR BEFORE SHIFT'));
    expect(text, contains('Workspace ID: shop-pilot-1'));
    expect(text, contains('Pilot scope: limbdi-wave-1'));
  });
}
