import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

import 'firebase_options.dart';

final class FirebaseBootstrap {
  static FirebaseApp? _app;

  static Future<void> initialize() async {
    if (_app != null) return;

    _app = await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    await _configureTelemetry();
  }

  static Future<void> _configureTelemetry() async {
    try {
      await FirebaseCrashlytics.instance
          .setCrashlyticsCollectionEnabled(kReleaseMode);
    } catch (_) {}

    try {
      await FirebasePerformance.instance
          .setPerformanceCollectionEnabled(kReleaseMode);
    } catch (_) {}
  }

  static Future<void> recordFlutterError(FlutterErrorDetails details) async {
    try {
      await FirebaseCrashlytics.instance.recordFlutterFatalError(details);
    } catch (_) {}
  }

  static Future<void> recordError(
    Object error,
    StackTrace stackTrace, {
    bool fatal = false,
  }) async {
    try {
      await FirebaseCrashlytics.instance.recordError(
        error,
        stackTrace,
        fatal: fatal,
      );
    } catch (_) {}
  }
}
