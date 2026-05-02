import 'pilot_evidence_tracker.dart';
import 'pilot_wave_signoff_pack.dart';

class PilotWaveArchivePack {
  const PilotWaveArchivePack({
    required this.waveSignoffPack,
    required this.evidenceTracker,
    required this.archiveStatus,
    required this.summary,
    required this.reasons,
    DateTime? generatedAt,
  }) : generatedAt = generatedAt ?? DateTime.now();

  final PilotWaveSignoffPack waveSignoffPack;
  final PilotEvidenceTrackerState evidenceTracker;
  final String archiveStatus;
  final String summary;
  final List<String> reasons;
  final DateTime generatedAt;

  bool get isArchiveReady => archiveStatus == 'archive_ready';
  bool get isArchiveWithAttention =>
      archiveStatus == 'archive_with_attention';
  bool get isArchiveIncomplete => archiveStatus == 'archive_incomplete';
  bool get isArchiveBlocked => archiveStatus == 'archive_blocked';

  String get archiveStatusLabel {
    switch (archiveStatus) {
      case 'archive_ready':
        return 'ARCHIVE READY';
      case 'archive_with_attention':
        return 'ARCHIVE WITH ATTENTION';
      case 'archive_incomplete':
        return 'ARCHIVE INCOMPLETE';
      case 'archive_blocked':
        return 'ARCHIVE BLOCKED';
      default:
        return archiveStatus.toUpperCase();
    }
  }

  static PilotWaveArchivePack evaluate({
    required PilotWaveSignoffPack waveSignoffPack,
    required PilotEvidenceTrackerState evidenceTracker,
  }) {
    final reasons = <String>[];
    final hasSignoffArtifact = evidenceTracker.isCaptured('wave_signoff_pack');

    if (waveSignoffPack.isSignoffBlocked) {
      reasons.add(
        'Wave signoff is blocked, so the device wave should not be archived yet.',
      );
      reasons.addAll(waveSignoffPack.reasons);
      return PilotWaveArchivePack(
        waveSignoffPack: waveSignoffPack,
        evidenceTracker: evidenceTracker,
        archiveStatus: 'archive_blocked',
        summary:
            'Do not archive this wave yet. The signoff posture is still blocked and the record should remain open.',
        reasons: reasons,
      );
    }

    if (waveSignoffPack.isSignoffIncomplete || !hasSignoffArtifact) {
      if (waveSignoffPack.isSignoffIncomplete) {
        reasons.add(
          'Wave signoff is still incomplete, so the archive record is not final yet.',
        );
      }
      if (!hasSignoffArtifact) {
        reasons.add(
          'The final wave signoff pack has not been copied into the evidence tracker yet.',
        );
      }
      reasons.addAll(waveSignoffPack.reasons);
      return PilotWaveArchivePack(
        waveSignoffPack: waveSignoffPack,
        evidenceTracker: evidenceTracker,
        archiveStatus: 'archive_incomplete',
        summary:
            'The wave archive is not ready yet because the final signoff package is still missing or incomplete.',
        reasons: reasons,
      );
    }

    if (waveSignoffPack.isSignoffWithMonitoring ||
        evidenceTracker.recentArchiveShowsAttention) {
      if (waveSignoffPack.isSignoffWithMonitoring) {
        reasons.add(
          'The device can be archived, but the rollout record should retain an explicit monitoring note.',
        );
      }
      if (evidenceTracker.recentArchiveShowsAttention) {
        reasons.add(
          'Recent archived sessions still show attention signs that should be preserved with the final archive.',
        );
      }
      reasons.addAll(waveSignoffPack.reasons);
      return PilotWaveArchivePack(
        waveSignoffPack: waveSignoffPack,
        evidenceTracker: evidenceTracker,
        archiveStatus: 'archive_with_attention',
        summary:
            'This wave can be archived, but the final record should carry the monitoring or attention context forward.',
        reasons: reasons,
      );
    }

    reasons.add(
      'Wave signoff is ready and the final signoff artifact has already been captured.',
    );
    reasons.add(
      'The evidence archive is stable enough to preserve as the permanent rollout record for this device wave.',
    );
    return PilotWaveArchivePack(
      waveSignoffPack: waveSignoffPack,
      evidenceTracker: evidenceTracker,
      archiveStatus: 'archive_ready',
      summary:
          'This device wave is ready to archive as a clean permanent rollout record.',
      reasons: reasons,
    );
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub wave archive pack',
      'Generated at (UTC): ${generatedAt.toUtc().toIso8601String()}',
      'Archive status: $archiveStatusLabel',
      'Summary: $summary',
      'Release fingerprint: ${waveSignoffPack.diagnosticsSnapshot.runtimeInfo.releaseFingerprint}',
      'Release tag: ${waveSignoffPack.diagnosticsSnapshot.runtimeInfo.releaseTag}',
      'Pilot scope: ${waveSignoffPack.diagnosticsSnapshot.runtimeInfo.rolloutScopeLabel}',
      'Workspace: ${waveSignoffPack.diagnosticsSnapshot.shop.name}',
      'Workspace ID: ${waveSignoffPack.diagnosticsSnapshot.workspaceId}',
      'Operator: ${waveSignoffPack.diagnosticsSnapshot.operatorEmail}',
      'Wave signoff: ${waveSignoffPack.signoffStatusLabel}',
      'Archive posture: ${evidenceTracker.archiveTrendLabel}',
      'Archived session count: ${evidenceTracker.archivedSessions.length}',
      'Latest archived session: ${evidenceTracker.latestArchivedSession?.sessionLabel ?? 'none'}',
      'Reasons:',
    ];

    if (reasons.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(reasons.map((reason) => '- $reason'));
    }

    lines.add('');
    lines.add('=== WAVE SIGNOFF PACK ===');
    lines.add(waveSignoffPack.toMultilineText());
    lines.add('');
    lines.add('=== EVIDENCE ARCHIVE ===');
    lines.add(evidenceTracker.toArchivePackText());

    return lines.join('\n');
  }
}
