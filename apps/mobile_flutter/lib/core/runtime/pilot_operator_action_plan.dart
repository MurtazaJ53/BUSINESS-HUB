import 'pilot_diagnostics_snapshot.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';

class PilotOperatorActionPlan {
  PilotOperatorActionPlan({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.actionId,
    required this.actionLabel,
    required this.summary,
    required this.reasons,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final String actionId;
  final String actionLabel;
  final String summary;
  final List<String> reasons;
  final DateTime generatedAt;

  bool get isIncidentAction => actionId == 'incident_escalation';
  bool get isRecoveryAction => actionId == 'recovery_desk';
  bool get isSmokeAction => actionId == 'smoke_checklist';
  bool get isSnapshotAction => actionId == 'pilot_snapshot';

  static PilotOperatorActionPlan evaluate({
    required PilotDiagnosticsSnapshot diagnosticsSnapshot,
    required PilotReadinessReport readinessReport,
    required PilotRecoveryReport recoveryReport,
  }) {
    final reasons = <String>[];

    if (readinessReport.isBlocked ||
        diagnosticsSnapshot.historyOverview.failedSales > 0 ||
        recoveryReport.attentionEntries.any((entry) => entry.isFailed)) {
      if (readinessReport.isBlocked) {
        reasons.add('Readiness is blocked for this device.');
      }
      if (diagnosticsSnapshot.historyOverview.failedSales > 0) {
        reasons.add('Failed receipts are still recorded on the device.');
      }
      if (recoveryReport.attentionEntries.any((entry) => entry.isFailed)) {
        reasons.add('Recovery desk still contains failed commerce commands.');
      }
      return PilotOperatorActionPlan(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionId: 'incident_escalation',
        actionLabel: 'Build incident escalation pack',
        summary:
            'This device has crossed into an incident posture. Capture the escalation pack and attach it to the support or rollout thread now.',
        reasons: reasons,
      );
    }

    if (diagnosticsSnapshot.pendingOutboxCount > 0 ||
        recoveryReport.attentionEntries.any(
          (entry) => entry.isQueued || entry.isSyncing,
        ) ||
        diagnosticsSnapshot.syncStatus.name == 'offline' ||
        diagnosticsSnapshot.syncStatus.name == 'syncing' ||
        diagnosticsSnapshot.syncStatus.name == 'error') {
      if (diagnosticsSnapshot.pendingOutboxCount > 0) {
        reasons.add(
          '${diagnosticsSnapshot.pendingOutboxCount} queued commerce command(s) still need replay.',
        );
      }
      if (recoveryReport.attentionEntries.any(
        (entry) => entry.isQueued || entry.isSyncing,
      )) {
        reasons.add(
          'Recovery desk still contains queued or syncing attention items.',
        );
      }
      if (diagnosticsSnapshot.syncStatus.name == 'offline') {
        reasons.add('The device is currently offline.');
      } else if (diagnosticsSnapshot.syncStatus.name == 'syncing') {
        reasons.add('Workspace sync is still running.');
      } else if (diagnosticsSnapshot.syncStatus.name == 'error') {
        reasons.add('A sync error flag is active on the device.');
      }
      return PilotOperatorActionPlan(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionId: 'recovery_desk',
        actionLabel: 'Use recovery desk',
        summary:
            'This device should clear replay and sync posture before moving deeper into rollout actions.',
        reasons: reasons,
      );
    }

    if (diagnosticsSnapshot.hasSignedInOperator &&
        diagnosticsSnapshot.workspaceId != 'No workspace bound') {
      reasons.add(
        'The device is bound to a workspace and has a signed-in operator.',
      );
      reasons.add(
        'Queue and recovery posture are currently clean enough for active floor validation.',
      );
      return PilotOperatorActionPlan(
        diagnosticsSnapshot: diagnosticsSnapshot,
        readinessReport: readinessReport,
        recoveryReport: recoveryReport,
        actionId: 'smoke_checklist',
        actionLabel: 'Run smoke checklist',
        summary:
            'This device is in a good posture for the next operator-facing validation step: run the smoke checklist and capture the result.',
        reasons: reasons,
      );
    }

    reasons.add('Operator or workspace identity is still incomplete.');
    return PilotOperatorActionPlan(
      diagnosticsSnapshot: diagnosticsSnapshot,
      readinessReport: readinessReport,
      recoveryReport: recoveryReport,
      actionId: 'pilot_snapshot',
      actionLabel: 'Copy pilot snapshot',
      summary:
          'Capture the device snapshot first so rollout or support has the baseline identity and posture before any further action.',
      reasons: reasons,
    );
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot operator action plan',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Recommended action: $actionLabel',
      'Summary: $summary',
      'Release fingerprint: ${diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Workspace: ${diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${diagnosticsSnapshot.workspaceId}',
      'Operator: ${diagnosticsSnapshot.operatorEmail}',
      'Readiness status: ${readinessReport.statusLabel}',
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

    return lines.join('\n');
  }
}
