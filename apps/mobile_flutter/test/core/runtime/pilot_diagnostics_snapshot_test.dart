import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/runtime/app_runtime_info.dart';
import 'package:business_hub_mobile/core/runtime/pilot_diagnostics_snapshot.dart';
import 'package:business_hub_mobile/core/sync/mobile_sync_coordinator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('release fingerprint stays readable when release sha is present', () {
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

    expect(runtime.releaseFingerprint, 'pilot | abc1234');
    expect(runtime.rolloutScopeLabel, 'limbdi-wave-1');
  });

  test('pilot snapshot exports launch-critical runtime details', () {
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

    final snapshot = PilotDiagnosticsSnapshot(
      runtimeInfo: runtime,
      shop: const ShopInfo(
        name: 'Limbdi Central',
        tagline: 'Retail control room',
        footer: 'Visit again',
        currency: 'INR',
        phone: '+91-98765-43210',
      ),
      session: null,
      backendBaseUrl: 'https://api.business-hub.test/api/v1',
      syncStatus: MobileSyncStatus.error,
      historyOverview: const HistoryOverview(
        totalSales: 12,
        syncedSales: 9,
        queuedSales: 2,
        failedSales: 1,
        totalRevenue: 24500,
        queuedRevenue: 3200,
        lastSyncedAt: null,
      ),
      pendingOutboxCount: 2,
      domainStates: const <DomainControlState>[
        DomainControlState(
          domain: 'sales',
          currentEpoch: 7,
          cutoverStatus: 'postgres_primary',
          writeMaster: 'postgres',
          controlPresent: true,
          shadowReadsEnabled: true,
          isEnabled: true,
          canWriteOnPostgresSurface: true,
          pilotSignoffStatus: 'production_safe',
          pilotRecommendedAction: 'hold_steady_state',
        ),
        DomainControlState(
          domain: 'inventory',
          currentEpoch: 4,
          cutoverStatus: 'pilot',
          writeMaster: 'firebase',
          controlPresent: true,
          shadowReadsEnabled: true,
          isEnabled: true,
          canWriteOnPostgresSurface: false,
          pilotSignoffStatus: 'monitoring',
          pilotRecommendedAction: 'verify_pilot',
        ),
      ],
      generatedAt: DateTime.utc(2026, 5, 2, 12, 30),
    );

    final text = snapshot.toMultilineText();

    expect(text, contains('Business Hub pilot launch snapshot'));
    expect(text, contains('Generated at (UTC): 2026-05-02T12:30:00.000Z'));
    expect(text, contains('Release fingerprint: pilot | abc1234'));
    expect(text, contains('Release tag: mobile-v1.3.9'));
    expect(text, contains('Pilot scope: limbdi-wave-1'));
    expect(text, contains('Workspace: Limbdi Central'));
    expect(text, contains('Operator: Not signed in'));
    expect(text, contains('Sync posture: ERROR'));
    expect(text, contains('Queued commerce commands: 2'));
    expect(text, contains('Domain posture: 1/2 primary'));
    expect(text, contains('- inventory: Pilot active | master=firebase | epoch=4 | next=verify_pilot'));
    expect(text, contains('- sales: Postgres primary | master=postgres | epoch=7 | next=hold_steady_state'));
  });
}
