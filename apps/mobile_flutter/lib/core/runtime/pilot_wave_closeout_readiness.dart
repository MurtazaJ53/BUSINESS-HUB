import 'pilot_diagnostics_snapshot.dart';
import 'pilot_evidence_tracker.dart';
import 'pilot_operator_action_plan.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';
import 'pilot_rollout_decision_summary.dart';

class PilotWaveCloseoutReadiness {
  PilotWaveCloseoutReadiness({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.actionPlan,
    required this.rolloutDecisionSummary,
    required this.evidenceTracker,
    required this.status,
    required this.summary,
    required this.reasons,
    required this.missingCloseoutArtifacts,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final PilotOperatorActionPlan actionPlan;
  final PilotRolloutDecisionSummary rolloutDecisionSummary;
  final PilotEvidenceTrackerState evidenceTracker;
  final String status;
  final String summary;
  final List<String> reasons;
  final List<PilotEvidenceArtifact> missingCloseoutArtifacts;
  final DateTime generatedAt;

  static const List<String> requiredArtifactIds = <String>[
    'rollout_decision_summary',
  ];

  bool get isReadyForCloseout => status == 'ready_for_closeout';
  bool get isCloseoutWithMonitoring => status == 'closeout_with_monitoring';
  bool get shouldCaptureMoreEvidence => status == 'capture_more_evidence';
  bool get shouldNotClose => status == 'do_not_close';

  String get statusLabel {
    switch (status) {
      case 'ready_for_closeout':
        return 'READY FOR CLOSEOUT';
      case 'closeout_with_monitoring':
        return 'CLOSEOUT WITH MONITORING';
      case 'capture_more_evidence':
        return 'CAPTURE MORE EVIDENCE';
      case 'do_not_close':
        return 'DO NOT CLOSE';
      default:
        return status.toUpperCase();
    }
  }

  String get closeoutArtifactsLabel {
    final total = evidenceTracker.totalCoreCount + requiredArtifactIds.length;
    final captured =
        evidenceTracker.capturedCoreCount +
        (requiredArtifactIds.length - missingCloseoutArtifacts.length);
    return '$captured / $total required closeout artifacts captured';
  }

  static PilotWaveCloseoutReadiness evaluate({
    required PilotDiagnosticsSnapshot diagnosticsSnapshot,
    required PilotReadinessReport readinessReport,
    required PilotRecoveryReport recoveryReport,
    required PilotOperatorActionPlan actionPlan,
    required PilotRolloutDecisionSummary rolloutDecisionSummary,
    required PilotEvidenceTrackerState evidenceTracker,
  }) {
    final reasons = <String>[];
    final missingCloseoutArtifacts = evidenceTracker.optionalArtifacts
        .where((artifact) => requiredArtifactIds.contains(artifact.id))
        .where((artifact) => !evidenceTracker.isCaptured(artifact.id))
        .toList(growable: false);

    if (rolloutDecisionSummary.shouldRollbackAndEscalate ||
        readinessReport.isBlocked ||
        actionPlan.isIncidentAction) {
      if (rolloutDecisionSummary.shouldRollbackAndEscalate) {
        reasons.add(
          'The rollout decision summary already recommends rollback or escalation.',
        );
      }
      if (readinessReport.isBlocked) {
        reasons.add('Readiness is still blocked on this device.');
      }
      if (actionPlan.isIncidentAction) {
        reasons.add(
          'The operator action center is in incident mode, so closeout would hide an active problem.',
        );
      }
      return PilotWaveCloseoutReadiness(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        rolloutDecisionSummary: rolloutDecisionSummary,
        evidenceTracker: evidenceTracker,
        status: 'do_not_close',
        summary:
            'Keep this wave open. The device is still in a posture that requires incident or rollback handling before closeout.',
        reasons: reasons,
        missingCloseoutArtifacts: missingCloseoutArtifacts,
      );
    }

    if (evidenceTracker.missingCoreCount > 0 ||
        missingCloseoutArtifacts.isNotEmpty) {
      if (evidenceTracker.missingCoreCount > 0) {
        reasons.add(
          '${evidenceTracker.missingCoreCount} core rollout artifact(s) are still missing from the active session.',
        );
      }
      if (missingCloseoutArtifacts.isNotEmpty) {
        reasons.add(
          'Required closeout artifact(s) are still missing: ${missingCloseoutArtifacts.map((artifact) => artifact.label).join(', ')}.',
        );
      }
      return PilotWaveCloseoutReadiness(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        rolloutDecisionSummary: rolloutDecisionSummary,
        evidenceTracker: evidenceTracker,
        status: 'capture_more_evidence',
        summary:
            'Do not close the wave record yet. Capture the missing evidence first so the handoff is complete.',
        reasons: reasons,
        missingCloseoutArtifacts: missingCloseoutArtifacts,
      );
    }

    if (rolloutDecisionSummary.shouldHoldAndMonitor ||
        rolloutDecisionSummary.shouldInvestigateBeforeExpand ||
        diagnosticsSnapshot.pendingOutboxCount > 0 ||
        recoveryReport.attentionEntries.isNotEmpty ||
        !evidenceTracker.hasArchivedSessions) {
      if (rolloutDecisionSummary.shouldHoldAndMonitor) {
        reasons.add(
          'The rollout decision summary still recommends monitoring instead of full expansion.',
        );
      }
      if (rolloutDecisionSummary.shouldInvestigateBeforeExpand) {
        reasons.add(
          'The rollout decision summary still recommends investigation before wider rollout.',
        );
      }
      if (diagnosticsSnapshot.pendingOutboxCount > 0) {
        reasons.add(
          '${diagnosticsSnapshot.pendingOutboxCount} queued commerce command(s) are still waiting on this device.',
        );
      }
      if (recoveryReport.attentionEntries.isNotEmpty) {
        reasons.add(
          '${recoveryReport.attentionEntries.length} recovery attention item(s) are still open.',
        );
      }
      if (!evidenceTracker.hasArchivedSessions) {
        reasons.add(
          'There is no archived shift history yet, so this device still needs more operational context before final closeout.',
        );
      }
      return PilotWaveCloseoutReadiness(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        rolloutDecisionSummary: rolloutDecisionSummary,
        evidenceTracker: evidenceTracker,
        status: 'closeout_with_monitoring',
        summary:
            'The wave record can be handed off, but it should remain under monitoring until the open signals settle.',
        reasons: reasons,
        missingCloseoutArtifacts: missingCloseoutArtifacts,
      );
    }

    reasons.add(
      'Required closeout evidence is captured for this session.',
    );
    reasons.add(
      'Current rollout posture is stable enough to close the device wave record cleanly.',
    );
    return PilotWaveCloseoutReadiness(
      diagnosticsSnapshot: diagnosticsSnapshot,
      readinessReport: readinessReport,
      recoveryReport: recoveryReport,
      actionPlan: actionPlan,
      rolloutDecisionSummary: rolloutDecisionSummary,
      evidenceTracker: evidenceTracker,
      status: 'ready_for_closeout',
      summary:
          'This device has the evidence and posture needed to close the current rollout wave record.',
      reasons: reasons,
      missingCloseoutArtifacts: missingCloseoutArtifacts,
    );
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub wave closeout readiness',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Status: $statusLabel',
      'Summary: $summary',
      'Release fingerprint: ${diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Workspace: ${diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${diagnosticsSnapshot.workspaceId}',
      'Operator: ${diagnosticsSnapshot.operatorEmail}',
      'Required closeout artifacts: $closeoutArtifactsLabel',
      'Rollout decision verdict: ${rolloutDecisionSummary.verdictLabel}',
      'Recommended next action: ${actionPlan.actionLabel}',
      'Archive posture: ${evidenceTracker.archiveTrendLabel}',
      'Queued commerce commands: ${diagnosticsSnapshot.pendingOutboxCount}',
      'Open recovery attention items: ${recoveryReport.attentionEntries.length}',
      'Reasons:',
    ];

    if (reasons.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(reasons.map((reason) => '- $reason'));
    }

    lines.add('Missing closeout artifacts:');
    if (missingCloseoutArtifacts.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(
        missingCloseoutArtifacts.map((artifact) => '- ${artifact.label}'),
      );
    }

    lines.add('');
    lines.add('=== ROLLOUT DECISION SUMMARY ===');
    lines.add(rolloutDecisionSummary.toMultilineText());

    return lines.join('\n');
  }
}
