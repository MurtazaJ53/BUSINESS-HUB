import 'pilot_diagnostics_snapshot.dart';
import 'pilot_readiness_report.dart';

enum PilotSmokeCheckOutcome { pending, passed, failed }

class PilotSmokeCheckDefinition {
  const PilotSmokeCheckDefinition({
    required this.id,
    required this.label,
    required this.isCritical,
  });

  final String id;
  final String label;
  final bool isCritical;
}

class PilotSmokeCheckResult {
  const PilotSmokeCheckResult({
    required this.check,
    required this.outcome,
  });

  final PilotSmokeCheckDefinition check;
  final PilotSmokeCheckOutcome outcome;

  bool get isPassed => outcome == PilotSmokeCheckOutcome.passed;
  bool get isFailed => outcome == PilotSmokeCheckOutcome.failed;
  bool get isPending => outcome == PilotSmokeCheckOutcome.pending;

  String get outcomeLabel {
    switch (outcome) {
      case PilotSmokeCheckOutcome.passed:
        return 'PASS';
      case PilotSmokeCheckOutcome.failed:
        return 'FAIL';
      case PilotSmokeCheckOutcome.pending:
        return 'PENDING';
    }
  }
}

const List<PilotSmokeCheckDefinition> defaultPilotSmokeChecks =
    <PilotSmokeCheckDefinition>[
      PilotSmokeCheckDefinition(
        id: 'owner_login',
        label: 'Owner login works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'staff_login',
        label: 'Staff login works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'inventory_search',
        label: 'Inventory search works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'scanner',
        label: 'Barcode / scanner flow works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'cash_sale',
        label: 'Cash sale works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'split_payment',
        label: 'Split payment sale works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'partial_due_sale',
        label: 'Partial / due sale works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'customer_attach',
        label: 'Customer attach in checkout works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'customer_ledger_payment',
        label: 'Customer ledger payment works',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'receipt_detail',
        label: 'History receipt detail works',
        isCritical: false,
      ),
      PilotSmokeCheckDefinition(
        id: 'build_identity',
        label: 'Settings build identity matches release',
        isCritical: true,
      ),
      PilotSmokeCheckDefinition(
        id: 'outbox_replay',
        label: 'Outbox replay succeeds after reconnect',
        isCritical: true,
      ),
    ];

class PilotSmokeReport {
  const PilotSmokeReport({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.results,
    this.operatorNotes,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final List<PilotSmokeCheckResult> results;
  final String? operatorNotes;
  final DateTime generatedAt;

  int get passedCount => results.where((item) => item.isPassed).length;
  int get failedCount => results.where((item) => item.isFailed).length;
  int get pendingCount => results.where((item) => item.isPending).length;

  bool get hasCriticalFailure =>
      results.any((item) => item.isFailed && item.check.isCritical);

  bool get hasAnyFailure => results.any((item) => item.isFailed);
  bool get hasPending => results.any((item) => item.isPending);

  String get verdict {
    if (hasCriticalFailure || readinessReport.isBlocked) {
      return 'blocked';
    }
    if (hasPending) {
      return 'incomplete';
    }
    if (hasAnyFailure || readinessReport.shouldMonitor) {
      return 'monitor';
    }
    return 'pass';
  }

  String get verdictLabel {
    switch (verdict) {
      case 'blocked':
        return 'BLOCKED';
      case 'incomplete':
        return 'INCOMPLETE';
      case 'monitor':
        return 'MONITOR';
      case 'pass':
        return 'PASS';
      default:
        return verdict.toUpperCase();
    }
  }

  String get summary {
    if (verdict == 'blocked') {
      return 'Critical smoke failures or a blocked readiness posture prevent this device from being approved for floor use.';
    }
    if (verdict == 'incomplete') {
      return 'The smoke checklist is still incomplete. Finish the pending checks before shift approval.';
    }
    if (verdict == 'monitor') {
      return 'The device can be used with caution, but failed non-critical checks or readiness warnings should be monitored.';
    }
    return 'Smoke execution is clean and the device is ready for pilot floor use.';
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot smoke execution report',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Verdict: $verdictLabel',
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
      'Pass count: $passedCount',
      'Fail count: $failedCount',
      'Pending count: $pendingCount',
      'Smoke checks:',
    ];

    for (final result in results) {
      final criticalLabel = result.check.isCritical ? 'critical' : 'standard';
      lines.add(
        '- ${result.check.label}: ${result.outcomeLabel} | priority=$criticalLabel',
      );
    }

    final trimmedNotes = operatorNotes?.trim() ?? '';
    lines.add('Operator notes:');
    lines.add(trimmedNotes.isEmpty ? '- none' : trimmedNotes);

    return lines.join('\n');
  }
}
