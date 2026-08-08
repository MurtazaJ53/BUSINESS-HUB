import 'package:business_hub_mobile/core/models/mobile_models.dart';
import 'package:business_hub_mobile/core/runtime/app_runtime_info.dart';
import 'package:business_hub_mobile/core/runtime/pilot_diagnostics_snapshot.dart';
import 'package:business_hub_mobile/core/runtime/pilot_readiness_report.dart';
import 'package:business_hub_mobile/core/runtime/pilot_recovery_report.dart';
import 'package:business_hub_mobile/core/runtime/pilot_rollout_evidence_report.dart';
import 'package:business_hub_mobile/core/sync/mobile_sync_coordinator.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  PilotDiagnosticsSnapshot buildDiagnostics() {
    const runtime = AppRuntimeInfo(
      appName: 'Business Hub',
      packageName: 'com.example.businesshub',
      version: '1.4.1',
      buildNumber: '15',
      releaseChannel: 'pilot',
      releaseSha: 'def5678',
      releaseTag: 'mobile-v1.4.1',
      pilotScope: 'rajkot-wave-1',
    );

    return PilotDiagnosticsSnapshot(
      runtimeInfo: runtime,
      shop: const ShopInfo(
        name: 'Rajkot Pilot',
        tagline: 'Fast retail',
        footer: 'Thanks',
        currency: 'INR',
        phone: '',
      ),
      session: null,
      backendBaseUrl: 'https://api.business-hub.test/api/v1',
      syncStatus: MobileSyncStatus.idle,
      historyOverview: const HistoryOverview(
        totalSales: 18,
        syncedSales: 18,
        queuedSales: 0,
        failedSales: 0,
        totalRevenue: 9800,
        queuedRevenue: 0,
        lastSyncedAt: null,
      ),
      operatorEmailOverride: 'owner@rajkot.test',
      operatorRoleOverride: 'owner',
      workspaceIdOverride: 'shop-rajkot-1',
      pendingOutboxCount: 0,
      domainStates: const <DomainControlState>[],
      generatedAt: DateTime.utc(2026, 5, 2, 23, 0),
    );
  }

  test('rollout evidence pack supports advance recommendation', () {
    final diagnostics = buildDiagnostics();
    final readiness = PilotReadinessReport.evaluate(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[],
    );
    final recovery = PilotRecoveryReport(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[],
      generatedAt: DateTime.utc(2026, 5, 2, 23, 5),
    );

    final report = PilotRolloutEvidenceReport(
      diagnosticsSnapshot: diagnostics,
      readinessReport: readiness,
      recoveryReport: recovery,
      answers: const PilotRolloutEvidenceAnswers(
        smokeVerdict: 'PASS',
        closeoutDecision: 'HEALTHY HANDOFF',
        rolloutRecommendation: 'advance_wave',
        smokeNotes: 'Smoke cleared cleanly.',
        closeoutNotes: 'Shift ended cleanly.',
        rolloutNotes: 'Wave can advance.',
      ),
      generatedAt: DateTime.utc(2026, 5, 2, 23, 15),
    );

    expect(report.recommendationLabel, 'ADVANCE WAVE');
    expect(report.summary, contains('advancing the current rollout wave'));
  });

  test('rollout evidence export includes embedded sections and scope', () {
    final diagnostics = buildDiagnostics();
    final readiness = PilotReadinessReport.evaluate(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[],
    );
    final recovery = PilotRecoveryReport(
      diagnosticsSnapshot: diagnostics,
      attentionEntries: const <CommerceOutboxAttentionEntry>[
        CommerceOutboxAttentionEntry(
          commandId: 'sale-1',
          commandType: 'sale_create',
          syncStatus: 'failed',
          total: 550,
          attemptCount: 3,
          updatedAt: 1714690800,
          customerName: 'Rahul',
          lastError: 'Timeout',
        ),
      ],
    );

    final report = PilotRolloutEvidenceReport(
      diagnosticsSnapshot: diagnostics,
      readinessReport: readiness,
      recoveryReport: recovery,
      answers: const PilotRolloutEvidenceAnswers(
        smokeVerdict: 'MONITOR',
        closeoutDecision: 'MONITOR NEXT SHIFT',
        rolloutRecommendation: 'hold_wave',
        smokeNotes: 'Scanner required a second try.',
        closeoutNotes: 'Replay fine after reconnect.',
        rolloutNotes: 'Hold this wave for one more day.',
      ),
    );

    final text = report.toMultilineText();

    expect(text, contains('Business Hub pilot rollout evidence pack'));
    expect(text, contains('Recommendation: HOLD CURRENT WAVE'));
    expect(text, contains('Pilot scope: rajkot-wave-1'));
    expect(text, contains('Smoke verdict: MONITOR'));
    expect(text, contains('Closeout decision: MONITOR NEXT SHIFT'));
    expect(text, contains('=== READINESS SIGNOFF ==='));
    expect(text, contains('=== LAUNCH SNAPSHOT ==='));
    expect(text, contains('=== RECOVERY REPORT ==='));
  });
}
