import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

/// Runs before every test. Initialises the test binding — the app theme loads
/// google_fonts, whose asset lookup needs the binding. (Runtime fetching is
/// left on so a failed network lookup falls back to a system font instead of
/// throwing.)
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  TestWidgetsFlutterBinding.ensureInitialized();
  await testMain();
}
