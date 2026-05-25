import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../app/app.dart';
import '../core/firebase/firebase_bootstrap.dart';

Future<void> bootstrapApplication() async {
  WidgetsFlutterBinding.ensureInitialized();

  ErrorWidget.builder = (details) {
    FirebaseBootstrap.recordError(
      details.exception,
      details.stack ?? StackTrace.current,
      fatal: false,
    );
    return const _FatalSurfaceFallback();
  };

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

class _FatalSurfaceFallback extends StatelessWidget {
  const _FatalSurfaceFallback();

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFF070B13),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: const Color(0xFF0B121F),
                borderRadius: BorderRadius.circular(26),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Container(
                      width: 62,
                      height: 62,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFB7185).withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Icon(
                        Icons.error_outline_rounded,
                        color: Color(0xFFFB7185),
                        size: 30,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'This screen hit a runtime problem',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Business Hub stopped this view from turning into a blank page. Please reopen the screen or refresh the workspace.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontWeight: FontWeight.w600,
                        height: 1.45,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
