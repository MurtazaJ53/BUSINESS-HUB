import 'pilot_diagnostics_snapshot.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';

class PilotShiftCloseoutAnswers {
  const PilotShiftCloseoutAnswers({
    required this.checkoutStable,
    required this.replayStable,
    required this.customerLedgerStable,
    required this.rollbackRequired,
    this.notes,
  });

  final bool checkoutStable;
  final bool replayStable;
  final bool customerLedgerStable;
  final bool rollbackRequired;
  final String? notes;
}

class PilotShiftCloseoutReport {
  const PilotShiftCloseoutReport({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.answers,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final PilotShiftCloseoutAnswers answers;
  final DateTime generatedAt;

  bool get hasFailedRecoveryItems =>
      recoveryReport.attentionEntries.any((entry) => entry.isFailed);

  bool get hasUnsettledReplayWork =>
      diagnosticsSnapshot.pendingOutboxCount > 0 ||
      recoveryReport.attentionEntries.any(
        (entry) => entry.isQueued || entry.isSyncing,
      );

  String get decision {
    if (answers.rollbackRequired ||
        !answers.checkoutStable ||
        !answers.replayStable ||
        hasFailedRecoveryItems) {
      return 'incident_escalation';
    }

    if (!answers.customerLedgerStable ||
        hasUnsettledReplayWork ||
        readinessReport.shouldMonitor ||
        diagnosticsSnapshot.syncStatus.name == 'offline' ||
        diagnosticsSnapshot.syncStatus.name == 'error') {
      return 'monitor_next_shift';
    }

    return 'healthy_handoff';
  }

  String get decisionLabel {
    switch (decision) {
      case 'incident_escalation':
        return 'ESCALATE INCIDENT';
      case 'monitor_next_shift':
        return 'MONITOR NEXT SHIFT';
      case 'healthy_handoff':
        return 'HEALTHY HANDOFF';
      default:
        return decision.toUpperCase();
    }
  }

  String get summary {
    if (decision == 'incident_escalation') {
      return 'This device should not be handed to the next shift without intervention, because a rollback-risk or unstable commerce path was reported.';
    }
    if (decision == 'monitor_next_shift') {
      return 'The device can continue into the next shift, but the rollout lead should monitor replay, ledger posture, or sync warnings closely.';
    }
    return 'The device finished the shift cleanly and is suitable for normal pilot handoff to the next operator.';
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot shift closeout report',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Decision: $decisionLabel',
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
      'Closeout checks:',
      '- Checkout stable: ${answers.checkoutStable ? 'YES' : 'NO'}',
      '- Replay stable: ${answers.replayStable ? 'YES' : 'NO'}',
      '- Customer ledger stable: ${answers.customerLedgerStable ? 'YES' : 'NO'}',
      '- Rollback required: ${answers.rollbackRequired ? 'YES' : 'NO'}',
      'Shift notes:',
    ];

    final trimmedNotes = answers.notes?.trim() ?? '';
    lines.add(trimmedNotes.isEmpty ? '- none' : trimmedNotes);

    return lines.join('\n');
  }
}
