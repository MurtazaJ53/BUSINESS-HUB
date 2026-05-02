import 'package:business_hub_mobile/core/runtime/pilot_evidence_tracker.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('tracker starts with all core artifacts missing', () {
    const tracker = PilotEvidenceTrackerState();

    expect(tracker.capturedCoreCount, 0);
    expect(tracker.totalCoreCount, greaterThan(0));
    expect(tracker.isCoreComplete, isFalse);
    expect(
      tracker.missingCoreArtifacts.map((artifact) => artifact.id),
      containsAll(<String>[
        'pilot_snapshot',
        'readiness_signoff',
        'smoke_report',
        'handoff_pack',
        'shift_closeout',
        'rollout_evidence',
      ]),
    );
  });

  test('markCaptured records timestamps and advances core completion', () {
    final tracker = const PilotEvidenceTrackerState()
        .ensureSession(
          defaultLabel: 'Bhavnagar wave 1',
          startedAt: DateTime.utc(2026, 5, 2, 7, 45),
        )
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .markCaptured(
          'readiness_signoff',
          capturedAt: DateTime.utc(2026, 5, 2, 8, 5),
        );

    expect(tracker.capturedCoreCount, 2);
    expect(tracker.latestCapturedArtifact?.id, 'readiness_signoff');
    expect(tracker.latestCapturedAt, DateTime.utc(2026, 5, 2, 8, 5));
    expect(tracker.isCaptured('pilot_snapshot'), isTrue);
    expect(tracker.sessionLabel, 'Bhavnagar wave 1');
  });

  test('markCaptured ignores unknown artifact ids', () {
    final tracker = const PilotEvidenceTrackerState().markCaptured('unknown');

    expect(tracker.capturedAtByArtifact, isEmpty);
  });

  test('toMultilineText includes captured and missing sections', () {
    final tracker = const PilotEvidenceTrackerState()
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .markCaptured(
          'operator_action_brief',
          capturedAt: DateTime.utc(2026, 5, 2, 8, 1),
        );

    final report = tracker.toMultilineText();

    expect(report, contains('Business Hub pilot evidence tracker'));
    expect(report, contains('Pilot snapshot'));
    expect(report, contains('Missing core artifacts:'));
    expect(report, contains('Readiness signoff'));
    expect(report, contains('Missing optional artifacts:'));
  });

  test('state round-trips through json payload', () {
    final tracker = const PilotEvidenceTrackerState()
        .ensureSession(
          defaultLabel: 'Wave 1 shift A',
          startedAt: DateTime.utc(2026, 5, 2, 7, 30),
        )
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .markCaptured(
          'rollout_evidence',
          capturedAt: DateTime.utc(2026, 5, 2, 9, 30),
        );

    final decoded = PilotEvidenceTrackerState.fromJson(
      tracker.toJson(),
    );

    expect(decoded.capturedCoreCount, tracker.capturedCoreCount);
    expect(decoded.latestCapturedArtifact?.id, 'rollout_evidence');
    expect(decoded.latestCapturedAt, DateTime.utc(2026, 5, 2, 9, 30));
    expect(decoded.sessionLabel, 'Wave 1 shift A');
    expect(decoded.sessionStartedAt, DateTime.utc(2026, 5, 2, 7, 30));
  });

  test('startFreshSession clears captures and stamps a new session window', () {
    final tracker = const PilotEvidenceTrackerState()
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .startFreshSession(
          sessionLabel: 'Wave 2 shift B',
          startedAt: DateTime.utc(2026, 5, 2, 10),
        );

    expect(tracker.capturedAtByArtifact, isEmpty);
    expect(tracker.sessionLabel, 'Wave 2 shift B');
    expect(tracker.sessionStartedAt, DateTime.utc(2026, 5, 2, 10));
    expect(tracker.lastResetAt, DateTime.utc(2026, 5, 2, 10));
  });

  test('startFreshSession archives the previous session summary', () {
    final tracker = const PilotEvidenceTrackerState()
        .ensureSession(
          defaultLabel: 'Wave 1 shift A',
          startedAt: DateTime.utc(2026, 5, 2, 7, 30),
        )
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .markCaptured(
          'readiness_signoff',
          capturedAt: DateTime.utc(2026, 5, 2, 8, 10),
        )
        .startFreshSession(
          sessionLabel: 'Wave 1 shift B',
          startedAt: DateTime.utc(2026, 5, 2, 12),
        );

    expect(tracker.sessionLabel, 'Wave 1 shift B');
    expect(tracker.archivedSessions, hasLength(1));
    expect(tracker.latestArchivedSession?.sessionLabel, 'Wave 1 shift A');
    expect(tracker.latestArchivedSession?.capturedCoreCount, 2);
    expect(
      tracker.latestArchivedSession?.latestCapturedArtifactLabel,
      'Readiness signoff',
    );
  });

  test('tracker text includes archived session summaries', () {
    final tracker = const PilotEvidenceTrackerState()
        .ensureSession(
          defaultLabel: 'Wave 1 shift A',
          startedAt: DateTime.utc(2026, 5, 2, 7, 30),
        )
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .startFreshSession(
          sessionLabel: 'Wave 1 shift B',
          startedAt: DateTime.utc(2026, 5, 2, 12),
        );

    final report = tracker.toMultilineText();

    expect(report, contains('Archived sessions: 1'));
    expect(report, contains('Wave 1 shift A'));
  });
}
