class PilotEvidenceTrackerState {
  const PilotEvidenceTrackerState({
    this.capturedAtByArtifact = const <String, DateTime>{},
    this.sessionLabel,
    this.sessionStartedAt,
    this.lastResetAt,
    this.archivedSessions = const <PilotEvidenceSessionArchiveEntry>[],
  });

  factory PilotEvidenceTrackerState.fromJson(Map<String, dynamic> json) {
    final rawEntries = json['captured_at_by_artifact'];
    final captured = <String, DateTime>{};
    if (rawEntries is Map) {
      for (final entry in rawEntries.entries) {
        final artifactId = entry.key.toString().trim();
        if (artifactId.isEmpty) {
          continue;
        }

        final value = entry.value;
        if (value is String) {
          final parsed = DateTime.tryParse(value);
          if (parsed != null) {
            captured[artifactId] = parsed.toUtc();
          }
        } else if (value is int) {
          captured[artifactId] = DateTime.fromMillisecondsSinceEpoch(
            value,
            isUtc: true,
          );
        } else if (value is num) {
          captured[artifactId] = DateTime.fromMillisecondsSinceEpoch(
            value.toInt(),
            isUtc: true,
          );
        }
      }
    }

    return PilotEvidenceTrackerState(
      capturedAtByArtifact: captured,
      sessionLabel: _readNullableString(json['session_label']),
      sessionStartedAt: _readNullableDateTime(json['session_started_at']),
      lastResetAt: _readNullableDateTime(json['last_reset_at']),
      archivedSessions: _readArchivedSessions(json['archived_sessions']),
    );
  }

  final Map<String, DateTime> capturedAtByArtifact;
  final String? sessionLabel;
  final DateTime? sessionStartedAt;
  final DateTime? lastResetAt;
  final List<PilotEvidenceSessionArchiveEntry> archivedSessions;

  static const List<PilotEvidenceArtifact> artifacts = <PilotEvidenceArtifact>[
    PilotEvidenceArtifact(
      id: 'pilot_snapshot',
      label: 'Pilot snapshot',
      isCore: true,
    ),
    PilotEvidenceArtifact(
      id: 'readiness_signoff',
      label: 'Readiness signoff',
      isCore: true,
    ),
    PilotEvidenceArtifact(
      id: 'smoke_report',
      label: 'Smoke report',
      isCore: true,
    ),
    PilotEvidenceArtifact(
      id: 'handoff_pack',
      label: 'Full handoff pack',
      isCore: true,
    ),
    PilotEvidenceArtifact(
      id: 'shift_closeout',
      label: 'Shift closeout',
      isCore: true,
    ),
    PilotEvidenceArtifact(
      id: 'rollout_evidence',
      label: 'Rollout evidence pack',
      isCore: true,
    ),
    PilotEvidenceArtifact(
      id: 'recovery_report',
      label: 'Recovery report',
      isCore: false,
    ),
    PilotEvidenceArtifact(
      id: 'incident_escalation',
      label: 'Incident escalation pack',
      isCore: false,
    ),
    PilotEvidenceArtifact(
      id: 'operator_action_brief',
      label: 'Operator action brief',
      isCore: false,
    ),
    PilotEvidenceArtifact(
      id: 'rollout_decision_summary',
      label: 'Rollout decision summary',
      isCore: false,
    ),
    PilotEvidenceArtifact(
      id: 'wave_closeout_readiness',
      label: 'Wave closeout readiness',
      isCore: false,
    ),
    PilotEvidenceArtifact(
      id: 'wave_signoff_pack',
      label: 'Wave signoff pack',
      isCore: false,
    ),
  ];

  static final Map<String, PilotEvidenceArtifact> _artifactById =
      <String, PilotEvidenceArtifact>{
        for (final artifact in artifacts) artifact.id: artifact,
      };

  List<PilotEvidenceArtifact> get coreArtifacts => artifacts
      .where((artifact) => artifact.isCore)
      .toList(growable: false);

  List<PilotEvidenceArtifact> get optionalArtifacts => artifacts
      .where((artifact) => !artifact.isCore)
      .toList(growable: false);

  int get capturedCoreCount => coreArtifacts
      .where((artifact) => isCaptured(artifact.id))
      .length;

  int get capturedOptionalCount => optionalArtifacts
      .where((artifact) => isCaptured(artifact.id))
      .length;

  int get totalCoreCount => coreArtifacts.length;

  int get totalOptionalCount => optionalArtifacts.length;

  int get missingCoreCount => missingCoreArtifacts.length;

  int get missingOptionalCount => missingOptionalArtifacts.length;

  int get archivedHealthyCount => archivedSessions
      .where((entry) => entry.isCoreComplete)
      .length;

  int get archivedAttentionCount => archivedSessions
      .where((entry) => !entry.isCoreComplete)
      .length;

  bool get recentArchiveShowsAttention => archivedSessions
      .take(3)
      .any((entry) => !entry.isCoreComplete);

  bool get isCoreComplete => missingCoreCount == 0;
  bool get hasSessionContext =>
      sessionLabel?.trim().isNotEmpty == true && sessionStartedAt != null;
  bool get hasArchivedSessions => archivedSessions.isNotEmpty;
  bool get hasStoredState =>
      capturedAtByArtifact.isNotEmpty ||
      hasSessionContext ||
      lastResetAt != null ||
      hasArchivedSessions;

  String get statusLabel => isCoreComplete ? 'CORE COMPLETE' : 'ACTION NEEDED';

  String get completionLabel =>
      '$capturedCoreCount / $totalCoreCount core exports captured';

  String get archiveTrendLabel {
    if (!hasArchivedSessions) {
      return 'No trend yet';
    }
    if (archivedAttentionCount == 0) {
      return 'Healthy trend';
    }
    if (archivedHealthyCount == 0) {
      return 'Attention trend';
    }
    return recentArchiveShowsAttention ? 'Mixed trend' : 'Recovering trend';
  }

  String get archiveInsightSummary {
    if (!hasArchivedSessions) {
      return 'No archived sessions captured yet.';
    }
    final recentSessions = archivedSessions.take(3).toList(growable: false);
    final healthyRecent = recentSessions
        .where((entry) => entry.isCoreComplete)
        .length;
    final attentionRecent = recentSessions.length - healthyRecent;
    return '$healthyRecent healthy / $attentionRecent attention across last ${recentSessions.length} archived sessions';
  }

  String get archiveOperationalGuidance {
    if (!hasArchivedSessions) {
      return 'Once a fresh session rolls over, archive posture will appear here so the rollout lead can compare recent shifts quickly.';
    }
    if (archivedAttentionCount == 0) {
      return 'Recent archived sessions closed cleanly. This device is building a stable evidence trail for the rollout record.';
    }
    if (recentArchiveShowsAttention) {
      return 'One or more recent archived sessions closed with missing core evidence. Review those gaps before widening the rollout wave.';
    }
    return 'Older archived sessions needed attention, but the most recent archive looks healthier. Keep monitoring before you expand rollout.';
  }

  List<PilotEvidenceArtifact> get missingCoreArtifacts => coreArtifacts
      .where((artifact) => !isCaptured(artifact.id))
      .toList(growable: false);

  List<PilotEvidenceArtifact> get missingOptionalArtifacts => optionalArtifacts
      .where((artifact) => !isCaptured(artifact.id))
      .toList(growable: false);

  PilotEvidenceArtifact? get latestCapturedArtifact {
    if (capturedAtByArtifact.isEmpty) {
      return null;
    }
    final latestEntry = capturedAtByArtifact.entries.reduce(
      (left, right) => left.value.isAfter(right.value) ? left : right,
    );
    return _artifactById[latestEntry.key];
  }

  DateTime? get latestCapturedAt {
    if (capturedAtByArtifact.isEmpty) {
      return null;
    }
    return capturedAtByArtifact.values.reduce(
      (left, right) => left.isAfter(right) ? left : right,
    );
  }

  bool isCaptured(String artifactId) => capturedAtByArtifact.containsKey(artifactId);

  PilotEvidenceSessionArchiveEntry? get latestArchivedSession =>
      archivedSessions.isEmpty ? null : archivedSessions.first;

  PilotEvidenceTrackerState markCaptured(
    String artifactId, {
    DateTime? capturedAt,
  }) {
    if (!_artifactById.containsKey(artifactId)) {
      return this;
    }
    final nextCapturedAt = capturedAt ?? DateTime.now();
    return PilotEvidenceTrackerState(
      capturedAtByArtifact: <String, DateTime>{
        ...capturedAtByArtifact,
        artifactId: nextCapturedAt,
      },
      sessionLabel: sessionLabel,
      sessionStartedAt: sessionStartedAt,
      lastResetAt: lastResetAt,
      archivedSessions: archivedSessions,
    );
  }

  PilotEvidenceTrackerState ensureSession({
    required String defaultLabel,
    DateTime? startedAt,
  }) {
    if (hasSessionContext) {
      return this;
    }
    return PilotEvidenceTrackerState(
      capturedAtByArtifact: capturedAtByArtifact,
      sessionLabel: defaultLabel.trim().isEmpty ? 'Pilot session' : defaultLabel.trim(),
      sessionStartedAt: startedAt ?? DateTime.now(),
      lastResetAt: lastResetAt,
      archivedSessions: archivedSessions,
    );
  }

  PilotEvidenceTrackerState startFreshSession({
    required String sessionLabel,
    DateTime? startedAt,
  }) {
    final nextStartedAt = startedAt ?? DateTime.now();
    final nextArchivedSessions = _buildArchivedSessions(nextStartedAt);
    return PilotEvidenceTrackerState(
      capturedAtByArtifact: const <String, DateTime>{},
      sessionLabel: sessionLabel.trim().isEmpty
          ? 'Pilot session'
          : sessionLabel.trim(),
      sessionStartedAt: nextStartedAt,
      lastResetAt: nextStartedAt,
      archivedSessions: nextArchivedSessions,
    );
  }

  PilotEvidenceTrackerState withoutArchivedSessions() {
    if (archivedSessions.isEmpty) {
      return this;
    }
    return PilotEvidenceTrackerState(
      capturedAtByArtifact: capturedAtByArtifact,
      sessionLabel: sessionLabel,
      sessionStartedAt: sessionStartedAt,
      lastResetAt: lastResetAt,
      archivedSessions: const <PilotEvidenceSessionArchiveEntry>[],
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'session_label': sessionLabel,
      'session_started_at': sessionStartedAt?.toUtc().toIso8601String(),
      'last_reset_at': lastResetAt?.toUtc().toIso8601String(),
      'archived_sessions': archivedSessions
          .map((entry) => entry.toJson())
          .toList(growable: false),
      'captured_at_by_artifact': <String, String>{
        for (final entry in capturedAtByArtifact.entries)
          entry.key: entry.value.toUtc().toIso8601String(),
      },
    };
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot evidence tracker',
      'Session label: ${sessionLabel ?? 'none'}',
      'Session started at (UTC): ${sessionStartedAt?.toUtc().toIso8601String() ?? 'none'}',
      'Last session reset at (UTC): ${lastResetAt?.toUtc().toIso8601String() ?? 'none'}',
      'Status: $statusLabel',
      'Core completion: $capturedCoreCount / $totalCoreCount',
      'Optional completion: $capturedOptionalCount / $totalOptionalCount',
      'Latest capture: ${latestCapturedArtifact?.label ?? 'none'}',
      'Latest capture at (UTC): ${latestCapturedAt?.toUtc().toIso8601String() ?? 'none'}',
      'Archived sessions: ${archivedSessions.length}',
      'Captured artifacts:',
    ];

    if (capturedAtByArtifact.isEmpty) {
      lines.add('- none');
    } else {
      for (final artifact in artifacts.where((item) => isCaptured(item.id))) {
        final capturedAt = capturedAtByArtifact[artifact.id]!;
        lines.add(
          '- ${artifact.label}: ${capturedAt.toUtc().toIso8601String()}',
        );
      }
    }

    lines.add('Missing core artifacts:');
    if (missingCoreArtifacts.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(missingCoreArtifacts.map((artifact) => '- ${artifact.label}'));
    }

    lines.add('Missing optional artifacts:');
    if (missingOptionalArtifacts.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(
        missingOptionalArtifacts.map((artifact) => '- ${artifact.label}'),
      );
    }

    lines.add('Archived sessions:');
    if (archivedSessions.isEmpty) {
      lines.add('- none');
    } else {
      lines.addAll(
        archivedSessions.map((entry) => '- ${entry.summaryLine}'),
      );
    }

    return lines.join('\n');
  }

  String toArchivePackText() {
    final lines = <String>[
      'Business Hub pilot evidence archive pack',
      'Active session label: ${sessionLabel ?? 'none'}',
      'Active session started at (UTC): ${sessionStartedAt?.toUtc().toIso8601String() ?? 'none'}',
      'Last reset at (UTC): ${lastResetAt?.toUtc().toIso8601String() ?? 'none'}',
      'Archived session count: ${archivedSessions.length}',
      '',
      '=== ACTIVE TRACKER ===',
      toMultilineText(),
      '',
      '=== ARCHIVED SESSIONS ===',
    ];

    if (archivedSessions.isEmpty) {
      lines.add('none');
    } else {
      for (final entry in archivedSessions) {
        lines.add(entry.toMultilineText());
        lines.add('');
      }
      if (lines.last.isEmpty) {
        lines.removeLast();
      }
    }

    return lines.join('\n');
  }

  String toArchiveInsightsText() {
    final lines = <String>[
      'Business Hub pilot evidence archive insights',
      'Archive posture: $archiveTrendLabel',
      'Archive summary: $archiveInsightSummary',
      'Guidance: $archiveOperationalGuidance',
      'Archived session count: ${archivedSessions.length}',
      'Latest archived session: ${latestArchivedSession?.sessionLabel ?? 'none'}',
      '',
      'Recent archived sessions:',
    ];

    if (archivedSessions.isEmpty) {
      lines.add('none');
    } else {
      for (final entry in archivedSessions.take(3)) {
        lines.add('- ${entry.summaryLine}');
      }
    }

    return lines.join('\n');
  }

  List<PilotEvidenceSessionArchiveEntry> _buildArchivedSessions(
    DateTime closedAt,
  ) {
    final nextEntries = <PilotEvidenceSessionArchiveEntry>[
      if (_shouldArchiveCurrentSession())
        PilotEvidenceSessionArchiveEntry(
          sessionLabel: sessionLabel ?? 'Pilot session',
          sessionStartedAt: sessionStartedAt ?? closedAt,
          sessionClosedAt: closedAt,
          capturedCoreCount: capturedCoreCount,
          totalCoreCount: totalCoreCount,
          capturedOptionalCount: capturedOptionalCount,
          totalOptionalCount: totalOptionalCount,
          latestCapturedArtifactLabel: latestCapturedArtifact?.label,
          latestCapturedAt: latestCapturedAt,
          statusLabel: statusLabel,
        ),
      ...archivedSessions,
    ];

    if (nextEntries.length <= 5) {
      return nextEntries;
    }
    return nextEntries.take(5).toList(growable: false);
  }

  bool _shouldArchiveCurrentSession() {
    return hasSessionContext || capturedAtByArtifact.isNotEmpty;
  }
}

String? _readNullableString(Object? value) {
  if (value == null) {
    return null;
  }
  final next = value.toString().trim();
  return next.isEmpty ? null : next;
}

DateTime? _readNullableDateTime(Object? value) {
  if (value is String) {
    return DateTime.tryParse(value)?.toUtc();
  }
  if (value is int) {
    return DateTime.fromMillisecondsSinceEpoch(value, isUtc: true);
  }
  if (value is num) {
    return DateTime.fromMillisecondsSinceEpoch(value.toInt(), isUtc: true);
  }
  return null;
}

List<PilotEvidenceSessionArchiveEntry> _readArchivedSessions(Object? value) {
  if (value is! List) {
    return const <PilotEvidenceSessionArchiveEntry>[];
  }

  final sessions = <PilotEvidenceSessionArchiveEntry>[];
  for (final item in value) {
    if (item is Map<String, dynamic>) {
      sessions.add(PilotEvidenceSessionArchiveEntry.fromJson(item));
      continue;
    }
    if (item is Map) {
      sessions.add(
        PilotEvidenceSessionArchiveEntry.fromJson(
          Map<String, dynamic>.from(item),
        ),
      );
    }
  }
  return sessions;
}

class PilotEvidenceSessionArchiveEntry {
  const PilotEvidenceSessionArchiveEntry({
    required this.sessionLabel,
    required this.sessionStartedAt,
    required this.sessionClosedAt,
    required this.capturedCoreCount,
    required this.totalCoreCount,
    required this.capturedOptionalCount,
    required this.totalOptionalCount,
    required this.statusLabel,
    this.latestCapturedArtifactLabel,
    this.latestCapturedAt,
  });

  factory PilotEvidenceSessionArchiveEntry.fromJson(Map<String, dynamic> json) {
    return PilotEvidenceSessionArchiveEntry(
      sessionLabel:
          _readNullableString(json['session_label']) ?? 'Pilot session',
      sessionStartedAt:
          _readNullableDateTime(json['session_started_at']) ?? DateTime.now(),
      sessionClosedAt:
          _readNullableDateTime(json['session_closed_at']) ?? DateTime.now(),
      capturedCoreCount: _readNullableInt(json['captured_core_count']) ?? 0,
      totalCoreCount: _readNullableInt(json['total_core_count']) ?? 0,
      capturedOptionalCount:
          _readNullableInt(json['captured_optional_count']) ?? 0,
      totalOptionalCount: _readNullableInt(json['total_optional_count']) ?? 0,
      statusLabel: _readNullableString(json['status_label']) ?? 'UNKNOWN',
      latestCapturedArtifactLabel:
          _readNullableString(json['latest_captured_artifact_label']),
      latestCapturedAt: _readNullableDateTime(json['latest_captured_at']),
    );
  }

  final String sessionLabel;
  final DateTime sessionStartedAt;
  final DateTime sessionClosedAt;
  final int capturedCoreCount;
  final int totalCoreCount;
  final int capturedOptionalCount;
  final int totalOptionalCount;
  final String statusLabel;
  final String? latestCapturedArtifactLabel;
  final DateTime? latestCapturedAt;

  bool get isCoreComplete =>
      statusLabel.trim().toUpperCase() == 'CORE COMPLETE' ||
      (totalCoreCount > 0 && capturedCoreCount >= totalCoreCount);

  String get summaryLine =>
      '$sessionLabel | $statusLabel | core $capturedCoreCount / $totalCoreCount | closed ${sessionClosedAt.toUtc().toIso8601String()}';

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'session_label': sessionLabel,
      'session_started_at': sessionStartedAt.toUtc().toIso8601String(),
      'session_closed_at': sessionClosedAt.toUtc().toIso8601String(),
      'captured_core_count': capturedCoreCount,
      'total_core_count': totalCoreCount,
      'captured_optional_count': capturedOptionalCount,
      'total_optional_count': totalOptionalCount,
      'status_label': statusLabel,
      'latest_captured_artifact_label': latestCapturedArtifactLabel,
      'latest_captured_at': latestCapturedAt?.toUtc().toIso8601String(),
    };
  }

  String toMultilineText() {
    return <String>[
      'Business Hub archived evidence session',
      'Session label: $sessionLabel',
      'Status: $statusLabel',
      'Session started at (UTC): ${sessionStartedAt.toUtc().toIso8601String()}',
      'Session closed at (UTC): ${sessionClosedAt.toUtc().toIso8601String()}',
      'Core completion: $capturedCoreCount / $totalCoreCount',
      'Optional completion: $capturedOptionalCount / $totalOptionalCount',
      'Latest capture: ${latestCapturedArtifactLabel ?? 'none'}',
      'Latest capture at (UTC): ${latestCapturedAt?.toUtc().toIso8601String() ?? 'none'}',
    ].join('\n');
  }
}

int? _readNullableInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value);
  }
  return null;
}

class PilotEvidenceArtifact {
  const PilotEvidenceArtifact({
    required this.id,
    required this.label,
    required this.isCore,
  });

  final String id;
  final String label;
  final bool isCore;
}
