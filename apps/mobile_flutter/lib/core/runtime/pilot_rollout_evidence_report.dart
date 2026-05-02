import 'pilot_diagnostics_snapshot.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';

class PilotRolloutEvidenceAnswers {
  const PilotRolloutEvidenceAnswers({
    required this.smokeVerdict,
    required this.closeoutDecision,
    required this.rolloutRecommendation,
    this.smokeNotes,
    this.closeoutNotes,
    this.rolloutNotes,
  });

  final String smokeVerdict;
  final String closeoutDecision;
  final String rolloutRecommendation;
  final String? smokeNotes;
  final String? closeoutNotes;
  final String? rolloutNotes;
}

class PilotRolloutEvidenceReport {
  const PilotRolloutEvidenceReport({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.answers,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final PilotRolloutEvidenceAnswers answers;
  final DateTime generatedAt;

  String get recommendationLabel {
    switch (answers.rolloutRecommendation) {
      case 'advance_wave':
        return 'ADVANCE WAVE';
      case 'hold_wave':
        return 'HOLD CURRENT WAVE';
      case 'rollback_wave':
        return 'ROLLBACK CURRENT WAVE';
      case 'manual_review':
        return 'MANUAL REVIEW';
      default:
        return answers.rolloutRecommendation.toUpperCase();
    }
  }

  String get summary {
    switch (answers.rolloutRecommendation) {
      case 'advance_wave':
        return 'This device evidence supports advancing the current rollout wave.';
      case 'hold_wave':
        return 'This device should stay in the current rollout wave while the team monitors the recorded concerns.';
      case 'rollback_wave':
        return 'This device indicates the current rollout wave should be rolled back or frozen.';
      case 'manual_review':
        return 'The rollout lead should review the evidence manually before making a wave decision.';
      default:
        return 'Rollout evidence has been recorded for manual interpretation.';
    }
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot rollout evidence pack',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Recommendation: $recommendationLabel',
      'Summary: $summary',
      'Release fingerprint: ${diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Version: ${diagnosticsSnapshot.runtimeInfo.versionLabel}',
      'Workspace: ${diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${diagnosticsSnapshot.workspaceId}',
      'Operator: ${diagnosticsSnapshot.operatorEmail}',
      'Backend API: ${diagnosticsSnapshot.backendBaseUrl}',
      'Readiness status: ${readinessReport.statusLabel}',
      'Sync posture: ${diagnosticsSnapshot.syncStatus.name.toUpperCase()}',
      'Queued commerce commands: ${diagnosticsSnapshot.pendingOutboxCount}',
      'Failed receipts: ${diagnosticsSnapshot.historyOverview.failedSales}',
      'Open recovery attention items: ${recoveryReport.attentionEntries.length}',
      'Smoke verdict: ${answers.smokeVerdict}',
      'Closeout decision: ${answers.closeoutDecision}',
      'Smoke notes:',
    ];

    final trimmedSmokeNotes = answers.smokeNotes?.trim() ?? '';
    lines.add(trimmedSmokeNotes.isEmpty ? '- none' : trimmedSmokeNotes);

    lines.add('Closeout notes:');
    final trimmedCloseoutNotes = answers.closeoutNotes?.trim() ?? '';
    lines.add(trimmedCloseoutNotes.isEmpty ? '- none' : trimmedCloseoutNotes);

    lines.add('Rollout lead notes:');
    final trimmedRolloutNotes = answers.rolloutNotes?.trim() ?? '';
    lines.add(trimmedRolloutNotes.isEmpty ? '- none' : trimmedRolloutNotes);

    lines.add('');
    lines.add('=== READINESS SIGNOFF ===');
    lines.add(readinessReport.toMultilineText());
    lines.add('');
    lines.add('=== LAUNCH SNAPSHOT ===');
    lines.add(diagnosticsSnapshot.toMultilineText());
    lines.add('');
    lines.add('=== RECOVERY REPORT ===');
    lines.add(recoveryReport.toMultilineText());

    return lines.join('\n');
  }
}
