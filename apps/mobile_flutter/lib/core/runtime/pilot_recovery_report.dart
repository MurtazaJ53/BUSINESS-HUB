import '../models/mobile_models.dart';
import 'pilot_diagnostics_snapshot.dart';

class PilotRecoveryReport {
  PilotRecoveryReport({
    required this.diagnosticsSnapshot,
    required this.attentionEntries,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final List<CommerceOutboxAttentionEntry> attentionEntries;
  final DateTime generatedAt;

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot recovery report',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Release fingerprint: ${diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Version: ${diagnosticsSnapshot.runtimeInfo.versionLabel}',
      'Workspace: ${diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${diagnosticsSnapshot.workspaceId}',
      'Operator: ${diagnosticsSnapshot.operatorEmail}',
      'Backend API: ${diagnosticsSnapshot.backendBaseUrl}',
      'Sync posture: ${diagnosticsSnapshot.syncStatus.name.toUpperCase()}',
      'Queued commerce commands: ${diagnosticsSnapshot.pendingOutboxCount}',
      'Failed receipts: ${diagnosticsSnapshot.historyOverview.failedSales}',
      'Last receipt sync (UTC): ${diagnosticsSnapshot.lastReceiptSyncLabel}',
      'Attention items:',
    ];

    if (attentionEntries.isEmpty) {
      lines.add('- none recorded');
      return lines.join('\n');
    }

    for (final entry in attentionEntries) {
      final customerLabel = (entry.customerName?.trim().isNotEmpty == true)
          ? entry.customerName!.trim()
          : 'Walk-in customer';
      final errorLabel = (entry.lastError?.trim().isNotEmpty == true)
          ? entry.lastError!.trim()
          : 'No error captured';
      lines.add(
        '- ${entry.commandLabel}: ${entry.statusLabel} | command=${entry.commandId} | customer=$customerLabel | total=${entry.total.toStringAsFixed(2)} | attempts=${entry.attemptCount} | last_error=$errorLabel',
      );
    }

    return lines.join('\n');
  }
}
