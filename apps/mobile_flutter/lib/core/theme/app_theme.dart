import 'package:flutter/material.dart';

final class AppTheme {
  static const _primary = Color(0xFF0EA5E9);
  static const _darkBackground = Color(0xFF05070B);
  static const _darkCard = Color(0xFF10141C);

  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    return base.copyWith(
      scaffoldBackgroundColor: _darkBackground,
      colorScheme: base.colorScheme.copyWith(
        primary: _primary,
        secondary: const Color(0xFF38BDF8),
        surface: _darkCard,
      ),
      cardTheme: const CardThemeData(
        color: _darkCard,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: _darkBackground,
        elevation: 0,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _darkCard,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide.none,
        ),
      ),
    );
  }

  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(primary: _primary),
    );
  }
}
