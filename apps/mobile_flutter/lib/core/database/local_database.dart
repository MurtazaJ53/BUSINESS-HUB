import 'package:flutter_riverpod/flutter_riverpod.dart';

final localDatabaseProvider = Provider<LocalDatabaseController>((ref) {
  return const LocalDatabaseController();
});

/// Drift / SQLite bootstrap placeholder.
///
/// The mobile rewrite will use local SQLite as the on-device source of truth.
/// We are keeping this bootstrap light until Flutter SDK tooling is available
/// and the first schema port begins.
final class LocalDatabaseController {
  const LocalDatabaseController();

  Future<void> initialize() async {
    await Future<void>.value();
  }
}
