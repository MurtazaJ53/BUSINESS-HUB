class PilotEvidenceTrackerState {
  const PilotEvidenceTrackerState({
    this.capturedAtByArtifact = const <String, DateTime>{},
    this.sessionLabel,
    this.sessionStartedAt,
    this.lastResetAt,
  });

  factory PilotEvidenceTrackerState.fromJson(Map<String, dynamic> json) {
    final rawEntries = json['captured_at_by_artifact'];
    if (rawEntries is! Map) {
      return const PilotEvidenceTrackerState();
    }

    final captured = <String, DateTime>{};
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

    return PilotEvidenceTrackerState(
      capturedAtByArtifact: captured,
      sessionLabel: _readNullableString(json['session_label']),
      sessionStartedAt: _readNullableDateTime(json['session_started_at']),
      lastResetAt: _readNullableDateTime(json['last_reset_at']),
    );
  }

  final Map<String, DateTime> capturedAtByArtifact;
  final String? sessionLabel;
  final DateTime? sessionStartedAt;
  final DateTime? lastResetAt;

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

  bool get isCoreComplete => missingCoreCount == 0;
  bool get hasSessionContext =>
      sessionLabel?.trim().isNotEmpty == true && sessionStartedAt != null;

  String get statusLabel => isCoreComplete ? 'CORE COMPLETE' : 'ACTION NEEDED';

  String get completionLabel =>
      '$capturedCoreCount / $totalCoreCount core exports captured';

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
    );
  }

  PilotEvidenceTrackerState startFreshSession({
    required String sessionLabel,
    DateTime? startedAt,
  }) {
    final nextStartedAt = startedAt ?? DateTime.now();
    return PilotEvidenceTrackerState(
      capturedAtByArtifact: const <String, DateTime>{},
      sessionLabel: sessionLabel.trim().isEmpty
          ? 'Pilot session'
          : sessionLabel.trim(),
      sessionStartedAt: nextStartedAt,
      lastResetAt: nextStartedAt,
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'session_label': sessionLabel,
      'session_started_at': sessionStartedAt?.toUtc().toIso8601String(),
      'last_reset_at': lastResetAt?.toUtc().toIso8601String(),
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

    return lines.join('\n');
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
