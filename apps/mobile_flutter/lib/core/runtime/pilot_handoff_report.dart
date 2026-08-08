import 'pilot_diagnostics_snapshot.dart';
import 'pilot_readiness_report.dart';
import 'pilot_recovery_report.dart';

class PilotHandoffReport {
  PilotHandoffReport({
    required this.diagnosticsSnapshot,
    required this.readinessReport,
    required this.recoveryReport,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final PilotReadinessReport readinessReport;
  final PilotRecoveryReport recoveryReport;
  final DateTime generatedAt;

  String toMultilineText() {
    return <String>[
      'Business Hub pilot handoff pack',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      '',
      '=== READINESS SIGNOFF ===',
      readinessReport.toMultilineText(),
      '',
      '=== LAUNCH SNAPSHOT ===',
      diagnosticsSnapshot.toMultilineText(),
      '',
      '=== RECOVERY REPORT ===',
      recoveryReport.toMultilineText(),
    ].join('\n');
  }
}
