import 'pilot_diagnostics_snapshot.dart';
import 'pilot_evidence_tracker.dart';
import 'pilot_operator_action_plan.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';

class PilotRolloutDecisionSummary {
  PilotRolloutDecisionSummary({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.actionPlan,
    required this.evidenceTracker,
    required this.verdict,
    required this.summary,
    required this.reasons,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final PilotOperatorActionPlan actionPlan;
  final PilotEvidenceTrackerState evidenceTracker;
  final String verdict;
  final String summary;
  final List<String> reasons;
  final DateTime generatedAt;

  bool get isReadyToExpand => verdict == 'ready_to_expand';
  bool get shouldHoldAndMonitor => verdict == 'hold_and_monitor';
  bool get shouldInvestigateBeforeExpand =>
      verdict == 'investigate_before_expand';
  bool get shouldRollbackAndEscalate => verdict == 'rollback_and_escalate';

  String get verdictLabel {
    switch (verdict) {
      case 'ready_to_expand':
        return 'READY TO EXPAND';
      case 'hold_and_monitor':
        return 'HOLD AND MONITOR';
      case 'investigate_before_expand':
        return 'INVESTIGATE BEFORE EXPAND';
      case 'rollback_and_escalate':
        return 'ROLLBACK AND ESCALATE';
      default:
        return verdict.toUpperCase();
    }
  }

  static PilotRolloutDecisionSummary evaluate({
    required PilotDiagnosticsSnapshot diagnosticsSnapshot,
    required PilotReadinessReport readinessReport,
    required PilotRecoveryReport recoveryReport,
    required PilotOperatorActionPlan actionPlan,
    required PilotEvidenceTrackerState evidenceTracker,
  }) {
    final reasons = <String>[];

    if (readinessReport.isBlocked || actionPlan.isIncidentAction) {
      if (readinessReport.isBlocked) {
        reasons.add(
          'Readiness is blocked, so this device should not be expanded into a wider rollout wave yet.',
        );
      }
      if (actionPlan.isIncidentAction) {
        reasons.add(
          'The operator action center is already recommending incident escalation.',
        );
      }
      if (evidenceTracker.recentArchiveShowsAttention) {
        reasons.add(
          'Recent archived sessions still show unresolved evidence attention.',
        );
      }
      return PilotRolloutDecisionSummary(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        evidenceTracker: evidenceTracker,
        verdict: 'rollback_and_escalate',
        summary:
            'Freeze rollout expansion for this device and escalate through rollback or incident handling before the next wave decision.',
        reasons: reasons,
      );
    }

    if (evidenceTracker.missingCoreCount > 0 ||
        evidenceTracker.recentArchiveShowsAttention) {
      if (evidenceTracker.missingCoreCount > 0) {
        reasons.add(
          '${evidenceTracker.missingCoreCount} core evidence artifact(s) are still missing for the active session.',
        );
      }
      if (evidenceTracker.recentArchiveShowsAttention) {
        reasons.add(
          'Recent archived sessions still show attention-needed closeouts.',
        );
      }
      if (actionPlan.isRecoveryAction) {
        reasons.add(
          'Recovery remains the recommended next operator action before rollout can widen.',
        );
      }
      return PilotRolloutDecisionSummary(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        evidenceTracker: evidenceTracker,
        verdict: 'investigate_before_expand',
        summary:
            'Do not expand this rollout device yet. Review evidence gaps and recent archive attention before making the next wave decision.',
        reasons: reasons,
      );
    }

    if (readinessReport.shouldMonitor ||
        actionPlan.isRecoveryAction ||
        diagnosticsSnapshot.pendingOutboxCount > 0 ||
        !evidenceTracker.hasArchivedSessions) {
      if (readinessReport.shouldMonitor) {
        reasons.add(
          'Current readiness is usable, but still flagged for monitoring.',
        );
      }
      if (actionPlan.isRecoveryAction) {
        reasons.add(
          'Queued or syncing recovery work still needs operator attention.',
        );
      }
      if (diagnosticsSnapshot.pendingOutboxCount > 0) {
        reasons.add(
          '${diagnosticsSnapshot.pendingOutboxCount} queued commerce command(s) are still present on this device.',
        );
      }
      if (!evidenceTracker.hasArchivedSessions) {
        reasons.add(
          'There is no archived shift history yet, so this device still needs more rollout evidence before expansion.',
        );
      }
      return PilotRolloutDecisionSummary(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionPlan: actionPlan,
        evidenceTracker: evidenceTracker,
        verdict: 'hold_and_monitor',
        summary:
            'This device can stay in the current rollout wave, but the lead should monitor it longer before expanding further.',
        reasons: reasons,
      );
    }

    reasons.add(
      'Current readiness is clean and the operator action center is no longer steering the device into recovery or incident work.',
    );
    reasons.add(
      'Core evidence is complete and recent archived sessions are trending healthy.',
    );
    return PilotRolloutDecisionSummary(
      diagnosticsSnapshot: diagnosticsSnapshot,
      readinessReport: readinessReport,
      recoveryReport: recoveryReport,
      actionPlan: actionPlan,
      evidenceTracker: evidenceTracker,
      verdict: 'ready_to_expand',
      summary:
          'This device is in a strong posture for controlled rollout expansion, assuming shop-level rollout governance also agrees.',
      reasons: reasons,
    );
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub rollout decision summary',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Verdict: $verdictLabel',
      'Summary: $summary',
      'Release fingerprint: ${diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Workspace: ${diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${diagnosticsSnapshot.workspaceId}',
      'Operator: ${diagnosticsSnapshot.operatorEmail}',
      'Readiness status: ${readinessReport.statusLabel}',
      'Recommended next action: ${actionPlan.actionLabel}',
      'Archive posture: ${evidenceTracker.archiveTrendLabel}',
      'Archive summary: ${evidenceTracker.archiveInsightSummary}',
      'Core evidence: ${evidenceTracker.completionLabel}',
      'Queued commerce commands: ${diagnosticsSnapshot.pendingOutboxCount}',
      'Failed receipts: ${diagnosticsSnapshot.historyOverview.failedSales}',
      'Open recovery attention items: ${recoveryReport.attentionEntries.length}',
      'Reasons:',
    ];

    if (reasons.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(reasons.map((reason) => '- $reason'));
    }

    lines.add('');
    lines.add('=== OPERATOR ACTION PLAN ===');
    lines.add(actionPlan.toMultilineText());
    lines.add('');
    lines.add('=== ARCHIVE INSIGHTS ===');
    lines.add(evidenceTracker.toArchiveInsightsText());

    return lines.join('\n');
  }
}
