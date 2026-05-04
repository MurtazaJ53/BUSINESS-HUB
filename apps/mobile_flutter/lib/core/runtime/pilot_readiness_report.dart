import '../models/mobile_models.dart';
import '../sync/mobile_sync_coordinator.dart';
import 'pilot_diagnostics_snapshot.dart';

class PilotReadinessReport {
  PilotReadinessReport({
    required this.diagnosticsSnapshot,
    required this.attentionEntries,
    required this.status,
    required this.summary,
    required this.blockers,
    required this.warnings,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotDiagnosticsSnapshot diagnosticsSnapshot;
  final List<CommerceOutboxAttentionEntry> attentionEntries;
  final String status;
  final String summary;
  final List<String> blockers;
  final List<String> warnings;
  final DateTime generatedAt;

  bool get isReadyForShift => status == 'ready_for_shift';
  bool get shouldMonitor => status == 'monitor_before_shift';
  bool get isBlocked => status == 'blocked_startup';

  String get statusLabel {
    switch (status) {
      case 'ready_for_shift':
        return 'READY FOR SHIFT';
      case 'monitor_before_shift':
        return 'MONITOR BEFORE SHIFT';
      case 'blocked_startup':
        return 'BLOCKED STARTUP';
      default:
        return status.toUpperCase();
    }
  }

  static PilotReadinessReport evaluate({
    required PilotDiagnosticsSnapshot diagnosticsSnapshot,
    required List<CommerceOutboxAttentionEntry> attentionEntries,
  }) {
    final blockers = <String>[];
    final warnings = <String>[];

    if (diagnosticsSnapshot.runtimeInfo.releaseChannel.trim().toLowerCase() ==
        'local') {
      blockers.add(
        'This build is still marked as local and should not be used as a pilot handoff build.',
      );
    }

    if (!diagnosticsSnapshot.hasSignedInOperator) {
      blockers.add('No signed-in operator is attached to this device.');
    }

    if (diagnosticsSnapshot.workspaceId == 'No workspace bound') {
      blockers.add('This device is not bound to a workspace yet.');
    }

    if (diagnosticsSnapshot.historyOverview.failedSales > 0) {
      blockers.add(
        'Failed receipts are still recorded on the device and must be reviewed before shift start.',
      );
    }

    if (attentionEntries.any((entry) => entry.isFailed)) {
      blockers.add(
        'The recovery desk still contains failed commerce commands.',
      );
    }

    final rollbackDomains = diagnosticsSnapshot.domainStates
        .where((state) => state.pilotSignoffStatus == 'rollback_recommended')
        .map((state) => state.domain.toUpperCase())
        .toList(growable: false);
    if (rollbackDomains.isNotEmpty) {
      blockers.add(
        'Cutover posture recommends rollback for: ${rollbackDomains.join(', ')}.',
      );
    }

    if (diagnosticsSnapshot.pendingOutboxCount > 0) {
      warnings.add(
        'There are ${diagnosticsSnapshot.pendingOutboxCount} queued commerce command(s) waiting to replay.',
      );
    }

    if (attentionEntries.any((entry) => entry.isSyncing)) {
      warnings.add(
        'One or more commerce commands are still syncing right now.',
      );
    }

    if (diagnosticsSnapshot.syncStatus == MobileSyncStatus.syncing) {
      warnings.add('Workspace sync is still in progress on this device.');
    }

    if (diagnosticsSnapshot.syncStatus == MobileSyncStatus.offline) {
      warnings.add(
        'The device is currently offline. Offline POS can continue, but pilot handoff should be monitored.',
      );
    }

    if (diagnosticsSnapshot.syncStatus == MobileSyncStatus.error &&
        blockers.isEmpty) {
      warnings.add(
        'A sync error flag is present even though no blocking replay failure is currently recorded.',
      );
    }

    final status = blockers.isNotEmpty
        ? 'blocked_startup'
        : warnings.isNotEmpty
        ? 'monitor_before_shift'
        : 'ready_for_shift';

    final summary = blockers.isNotEmpty
        ? 'This device should not start a pilot shift until the blocking issues are cleared.'
        : warnings.isNotEmpty
        ? 'This device can be used, but the rollout lead should monitor the warnings before or during shift start.'
        : 'This device is operationally clean for pilot shift start.';

    return PilotReadinessReport(
      diagnosticsSnapshot: diagnosticsSnapshot,
      attentionEntries: attentionEntries,
      status: status,
      summary: summary,
      blockers: blockers,
      warnings: warnings,
    );
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot readiness signoff',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Status: $statusLabel',
      'Summary: $summary',
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
      'Blockers:',
    ];

    if (blockers.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(blockers.map((item) => '- $item'));
    }

    lines.add('Warnings:');
    if (warnings.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(warnings.map((item) => '- $item'));
    }

    return lines.join('\n');
  }
}
