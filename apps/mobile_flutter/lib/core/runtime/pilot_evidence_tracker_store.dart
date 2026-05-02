import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../database/mobile_repository.dart';
import 'pilot_evidence_tracker.dart';

final pilotEvidenceTrackerProvider =
    StreamProvider<PilotEvidenceTrackerState>((ref) {
      return ref.watch(shopRepositoryProvider).watchPilotEvidenceTracker();
    });

final pilotEvidenceTrackerControllerProvider =
    Provider<PilotEvidenceTrackerController>((ref) {
      return PilotEvidenceTrackerController(ref.watch(shopRepositoryProvider));
    });

class PilotEvidenceTrackerController {
  PilotEvidenceTrackerController(this._shopRepository);

  final ShopRepository _shopRepository;

  Future<void> markCaptured(String artifactId, {DateTime? capturedAt}) {
    return _shopRepository.markPilotEvidenceCaptured(
      artifactId,
      capturedAt: capturedAt,
    );
  }

  Future<void> ensureSession(String defaultLabel) {
    return _shopRepository.ensurePilotEvidenceSession(defaultLabel);
  }

  Future<void> startFreshSession(String sessionLabel) {
    return _shopRepository.startFreshPilotEvidenceSession(sessionLabel);
  }

  Future<void> reset() {
    return _shopRepository.resetPilotEvidenceTracker();
  }

  Future<void> clearArchive() {
    return _shopRepository.clearPilotEvidenceArchive();
  }
}
