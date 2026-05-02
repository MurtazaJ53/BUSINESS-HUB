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
        .markCaptured('pilot_snapshot', capturedAt: DateTime.utc(2026, 5, 2, 8))
        .markCaptured(
          'readiness_signoff',
          capturedAt: DateTime.utc(2026, 5, 2, 8, 5),
        );

    expect(tracker.capturedCoreCount, 2);
    expect(tracker.latestCapturedArtifact?.id, 'readiness_signoff');
    expect(tracker.latestCapturedAt, DateTime.utc(2026, 5, 2, 8, 5));
    expect(tracker.isCaptured('pilot_snapshot'), isTrue);
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
}
