import 'pilot_diagnostics_snapshot.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';

class PilotIncidentEscalationAnswers {
  const PilotIncidentEscalationAnswers({
    required this.severity,
    required this.impactScope,
    required this.checkoutBlocked,
    required this.moneyMovementRisk,
    required this.rollbackRequested,
    this.notes,
  });

  final String severity;
  final String impactScope;
  final bool checkoutBlocked;
  final bool moneyMovementRisk;
  final bool rollbackRequested;
  final String? notes;
}

class PilotIncidentEscalationReport {
  PilotIncidentEscalationReport({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    required this.answers,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final PilotIncidentEscalationAnswers answers;
  final DateTime generatedAt;

  bool get hasFailedRecoveryItems =>
      recoveryReport.attentionEntries.any((entry) => entry.isFailed);

  String get severityLabel {
    switch (answers.severity) {
      case 'sev1':
        return 'SEV1';
      case 'sev2':
        return 'SEV2';
      case 'sev3':
        return 'SEV3';
      default:
        return answers.severity.toUpperCase();
    }
  }

  String get impactScopeLabel {
    switch (answers.impactScope) {
      case 'single_device':
        return 'SINGLE DEVICE';
      case 'single_shop':
        return 'SINGLE SHOP';
      case 'wave':
        return 'ROLLOUT WAVE';
      default:
        return answers.impactScope.toUpperCase();
    }
  }

  String get escalationDecision {
    if (answers.rollbackRequested ||
        answers.moneyMovementRisk ||
        answers.checkoutBlocked) {
      return 'immediate_escalation';
    }
    if (hasFailedRecoveryItems || readinessReport.isBlocked) {
      return 'urgent_review';
    }
    return 'monitor_with_support';
  }

  String get escalationDecisionLabel {
    switch (escalationDecision) {
      case 'immediate_escalation':
        return 'IMMEDIATE ESCALATION';
      case 'urgent_review':
        return 'URGENT REVIEW';
      case 'monitor_with_support':
        return 'MONITOR WITH SUPPORT';
      default:
        return escalationDecision.toUpperCase();
    }
  }

  String get summary {
    if (escalationDecision == 'immediate_escalation') {
      return 'This device requires immediate escalation because checkout, money movement, or rollback risk is present.';
    }
    if (escalationDecision == 'urgent_review') {
      return 'This device should be reviewed urgently because blocked readiness or failed recovery items are still active.';
    }
    return 'Support should monitor this device, but the incident does not currently require immediate rollback or stop-use instructions.';
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot incident escalation pack',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Escalation decision: $escalationDecisionLabel',
      'Summary: $summary',
      'Severity: $severityLabel',
      'Impact scope: $impactScopeLabel',
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
      'Incident flags:',
      '- Checkout blocked: ${answers.checkoutBlocked ? 'YES' : 'NO'}',
      '- Money movement risk: ${answers.moneyMovementRisk ? 'YES' : 'NO'}',
      '- Rollback requested: ${answers.rollbackRequested ? 'YES' : 'NO'}',
      'Incident notes:',
    ];

    final trimmedNotes = answers.notes?.trim() ?? '';
    lines.add(trimmedNotes.isEmpty ? '- none' : trimmedNotes);

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
