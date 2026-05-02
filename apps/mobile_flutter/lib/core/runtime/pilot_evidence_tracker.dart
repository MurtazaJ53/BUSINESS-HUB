class PilotEvidenceTrackerState {
  const PilotEvidenceTrackerState({
    this.capturedAtByArtifact = const <String, DateTime>{},
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

    return PilotEvidenceTrackerState(capturedAtByArtifact: captured);
  }

  final Map<String, DateTime> capturedAtByArtifact;

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
    return PilotEvidenceTrackerState(
      capturedAtByArtifact: <String, DateTime>{
        ...capturedAtByArtifact,
        artifactId: capturedAt ?? DateTime.now(),
      },
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'captured_at_by_artifact': <String, String>{
        for (final entry in capturedAtByArtifact.entries)
          entry.key: entry.value.toUtc().toIso8601String(),
      },
    };
  }

  String toMultilineText() {
    final lines = <String>[
      'Business Hub pilot evidence tracker',
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
