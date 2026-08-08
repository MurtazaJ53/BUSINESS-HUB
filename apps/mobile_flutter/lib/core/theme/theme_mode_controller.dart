import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Controls the app's light/dark presentation.
///
/// Defaults to [ThemeMode.system] so the app follows the device setting out of
/// the box — important for POS staff who switch between a bright shop floor and
/// a dim back office. Users can override via Settings. Persisting the override
/// (e.g. to the drift settings store) is a follow-up; today the override lives
/// for the session.
final themeModeProvider =
    NotifierProvider<ThemeModeController, ThemeMode>(ThemeModeController.new);

class ThemeModeController extends Notifier<ThemeMode> {
  // Business Hub is a blue-and-white (light only) app, so we pin light mode.
  @override
  ThemeMode build() => ThemeMode.light;

  void set(ThemeMode mode) => state = mode;

  void toggle() {
    state = switch (state) {
      ThemeMode.light => ThemeMode.dark,
      ThemeMode.dark => ThemeMode.light,
      ThemeMode.system => ThemeMode.dark,
    };
  }
}
