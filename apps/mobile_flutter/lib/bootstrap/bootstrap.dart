import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/app.dart';
import '../core/database/local_database.dart';
import '../core/firebase/firebase_bootstrap.dart';

Future<void> bootstrapApplication() async {
  WidgetsFlutterBinding.ensureInitialized();

  await FirebaseBootstrap.initialize();
  await const LocalDatabaseController().initialize();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    FirebaseBootstrap.recordFlutterError(details);
  };

  PlatformDispatcher.instance.onError = (error, stackTrace) {
    FirebaseBootstrap.recordError(error, stackTrace, fatal: true);
    return true;
  };

  runApp(const ProviderScope(child: BusinessHubMobileApp()));
}
