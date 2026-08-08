import 'pilot_diagnostics_snapshot.dart';
import 'pilot_evidence_tracker.dart';
import 'pilot_operator_action_plan.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';
import 'pilot_rollout_decision_summary.dart';
import 'pilot_wave_closeout_readiness.dart';

class PilotWaveSignoffPack {
  PilotWaveSignoffPack({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.actionPlan,
    required this.rolloutDecisionSummary,
    required this.waveCloseoutReadiness,
    required this.evidenceTracker,
    required this.signoffStatus,
    required this.summary,
    required this.reasons,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final PilotOperatorActionPlan actionPlan;
  final PilotRolloutDecisionSummary rolloutDecisionSummary;
  final PilotWaveCloseoutReadiness waveCloseoutReadiness;
  final PilotEvidenceTrackerState evidenceTracker;
  final String signoffStatus;
  final String summary;
  final List<String> reasons;
  final DateTime generatedAt;

  bool get isSignoffReady => signoffStatus == 'signoff_ready';
  bool get isSignoffWithMonitoring =>
      signoffStatus == 'signoff_with_monitoring';
  bool get isSignoffIncomplete => signoffStatus == 'signoff_incomplete';
  bool get isSignoffBlocked => signoffStatus == 'signoff_blocked';

  String get signoffStatusLabel {
    switch (signoffStatus) {
      case 'signoff_ready':
        return 'SIGNOFF READY';
      case 'signoff_with_monitoring':
        return 'SIGNOFF WITH MONITORING';
      case 'signoff_incomplete':
        return 'SIGNOFF INCOMPLETE';
      case 'signoff_blocked':
        return 'SIGNOFF BLOCKED';
      default:
        return signoffStatus.toUpperCase();
    }
  }

  static PilotWaveSignoffPack evaluate({
    required PilotDiagnosticsSnapshot diagnosticsSnapshot,
    required PilotReadinessReport readinessReport,
    required PilotRecoveryReport recoveryReport,
    required PilotOperatorActionPlan actionPlan,
    required PilotRolloutDecisionSummary rolloutDecisionSummary,
    required PilotWaveCloseoutReadiness waveCloseoutReadiness,
    required PilotEvidenceTrackerState evidenceTracker,
  }) {
    final reasons = <String>[];

    if (waveCloseoutReadiness.shouldNotClose) {
      reasons.add(
        'Wave closeout readiness is blocked, so the device cannot be signed off yet.',
      );
      reasons.addAll(waveCloseoutReadiness.reasons);
      return PilotWaveSignoffPack(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        rolloutDecisionSummary: rolloutDecisionSummary,
        waveCloseoutReadiness: waveCloseoutReadiness,
        evidenceTracker: evidenceTracker,
        signoffStatus: 'signoff_blocked',
        summary:
            'Do not sign off this device wave. Keep the wave open until the blocking rollout issues are resolved.',
        reasons: reasons,
      );
    }

    if (waveCloseoutReadiness.shouldCaptureMoreEvidence) {
      reasons.add(
        'Wave closeout readiness still needs more evidence before handoff can be signed off.',
      );
      reasons.addAll(waveCloseoutReadiness.reasons);
      return PilotWaveSignoffPack(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        rolloutDecisionSummary: rolloutDecisionSummary,
        waveCloseoutReadiness: waveCloseoutReadiness,
        evidenceTracker: evidenceTracker,
        signoffStatus: 'signoff_incomplete',
        summary:
            'This device is not ready for final signoff yet because the wave record is still missing required closeout evidence.',
        reasons: reasons,
      );
    }

    if (waveCloseoutReadiness.isCloseoutWithMonitoring) {
      reasons.add(
        'Wave closeout is allowed, but monitoring must continue after handoff.',
      );
      reasons.addAll(waveCloseoutReadiness.reasons);
      return PilotWaveSignoffPack(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        rolloutDecisionSummary: rolloutDecisionSummary,
        waveCloseoutReadiness: waveCloseoutReadiness,
        evidenceTracker: evidenceTracker,
        signoffStatus: 'signoff_with_monitoring',
        summary:
            'This device can be signed off into the next wave handoff, but the rollout lead should keep explicit monitoring in place.',
        reasons: reasons,
      );
    }

    reasons.add(
      'Wave closeout readiness is clean and all required closeout evidence has been captured.',
    );
    reasons.add(
      'The rollout decision and archive trend both support a clean handoff posture.',
    );
    return PilotWaveSignoffPack(
      diagnosticsSnapshot: diagnosticsSnapshot,
      readinessReport: readinessReport,
      recoveryReport: recoveryReport,
      actionPlan: actionPlan,
      rolloutDecisionSummary: rolloutDecisionSummary,
      waveCloseoutReadiness: waveCloseoutReadiness,
      evidenceTracker: evidenceTracker,
      signoffStatus: 'signoff_ready',
      summary:
          'This device is ready for final wave signoff and can be archived in the rollout record as a clean handoff.',
      reasons: reasons,
    );
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub wave signoff pack',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Signoff status: $signoffStatusLabel',
      'Summary: $summary',
      'Release fingerprint: ${diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Workspace: ${diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${diagnosticsSnapshot.workspaceId}',
      'Operator: ${diagnosticsSnapshot.operatorEmail}',
      'Wave closeout readiness: ${waveCloseoutReadiness.statusLabel}',
      'Rollout decision verdict: ${rolloutDecisionSummary.verdictLabel}',
      'Archive posture: ${evidenceTracker.archiveTrendLabel}',
      'Recommended next action: ${actionPlan.actionLabel}',
      'Reasons:',
    ];

    if (reasons.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(reasons.map((reason) => '- $reason'));
    }

    lines.add('');
    lines.add('=== WAVE CLOSEOUT READINESS ===');
    lines.add(waveCloseoutReadiness.toMultilineText());
    lines.add('');
    lines.add('=== EVIDENCE TRACKER SNAPSHOT ===');
    lines.add(evidenceTracker.toMultilineText());

    return lines.join('\n');
  }
}
