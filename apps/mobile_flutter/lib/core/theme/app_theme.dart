import 'package:flutter/material.dart';

final class AppPalette {
  static const Color background = Color(0xFF101216);
  static const Color backgroundSoft = Color(0xFF161A20);
  static const Color backgroundAlt = Color(0xFF1C212B);
  static const Color panel = Color(0xFF1A2029);
  static const Color panelStrong = Color(0xFF232A36);
  static const Color panelMuted = Color(0xFF262E3B);
  static const Color line = Color(0xFF394250);
  static const Color lineSoft = Color(0xFF2A313D);
  static const Color textPrimary = Color(0xFFF7F1E7);
  static const Color textSecondary = Color(0xFFD4C6B3);
  static const Color textMuted = Color(0xFF9C927F);
  static const Color primary = Color(0xFFE58A47);
  static const Color primaryDeep = Color(0xFFB45F28);
  static const Color gold = Color(0xFFF0C879);
  static const Color jade = Color(0xFF4EB79B);
  static const Color coral = Color(0xFFEF6B67);
  static const Color cobalt = Color(0xFF7CA4F8);
  static const Color smoke = Color(0xFF2B3342);
}

final class AppTheme {
  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    final scheme = const ColorScheme.dark(
      primary: AppPalette.primary,
      secondary: AppPalette.gold,
      tertiary: AppPalette.jade,
      error: AppPalette.coral,
      surface: AppPalette.panel,
      onPrimary: Color(0xFF130E08),
      onSecondary: Color(0xFF1D1607),
      onTertiary: Color(0xFF081613),
      onSurface: AppPalette.textPrimary,
      onError: AppPalette.textPrimary,
      outline: AppPalette.line,
      surfaceContainerHighest: AppPalette.panelStrong,
      secondaryContainer: AppPalette.panelMuted,
      tertiaryContainer: AppPalette.smoke,
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppPalette.background,
      colorScheme: scheme,
      canvasColor: AppPalette.backgroundSoft,
      splashColor: AppPalette.primary.withValues(alpha: 0.12),
      highlightColor: AppPalette.gold.withValues(alpha: 0.08),
      dividerColor: AppPalette.lineSoft,
      textTheme: base.textTheme
          .apply(
            bodyColor: AppPalette.textPrimary,
            displayColor: AppPalette.textPrimary,
          )
          .copyWith(
            headlineLarge: base.textTheme.headlineLarge?.copyWith(
              fontWeight: FontWeight.w900,
              letterSpacing: -1.35,
              height: 0.95,
            ),
            headlineMedium: base.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w900,
              letterSpacing: -1.05,
              height: 0.96,
            ),
            headlineSmall: base.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w900,
              letterSpacing: -0.72,
              height: 0.98,
            ),
            titleLarge: base.textTheme.titleLarge?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.45,
            ),
            titleMedium: base.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -0.2,
            ),
            bodyLarge: base.textTheme.bodyLarge?.copyWith(
              color: AppPalette.textSecondary,
              fontWeight: FontWeight.w600,
              height: 1.55,
            ),
            bodyMedium: base.textTheme.bodyMedium?.copyWith(
              color: AppPalette.textSecondary,
              fontWeight: FontWeight.w600,
              height: 1.5,
            ),
            bodySmall: base.textTheme.bodySmall?.copyWith(
              color: AppPalette.textMuted,
              fontWeight: FontWeight.w600,
            ),
            labelSmall: base.textTheme.labelSmall?.copyWith(
              color: AppPalette.textMuted,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.3,
            ),
          ),
      cardTheme: const CardThemeData(
        color: AppPalette.panel,
        elevation: 0,
        margin: EdgeInsets.zero,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppPalette.panelStrong,
        contentTextStyle: const TextStyle(
          color: AppPalette.textPrimary,
          fontWeight: FontWeight.w700,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        behavior: SnackBarBehavior.floating,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppPalette.backgroundSoft,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppPalette.backgroundSoft,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(30)),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppPalette.background,
        elevation: 0,
        centerTitle: false,
        foregroundColor: AppPalette.textPrimary,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppPalette.primary,
          foregroundColor: const Color(0xFF170F08),
          disabledBackgroundColor: AppPalette.panelMuted,
          disabledForegroundColor: AppPalette.textMuted,
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          textStyle: const TextStyle(
            fontWeight: FontWeight.w900,
            letterSpacing: 0.15,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppPalette.textPrimary,
          side: const BorderSide(color: AppPalette.line),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppPalette.gold,
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: AppPalette.panelMuted,
        selectedColor: AppPalette.primary.withValues(alpha: 0.2),
        side: const BorderSide(color: AppPalette.lineSoft),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        labelStyle: const TextStyle(
          color: AppPalette.textPrimary,
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppPalette.panelMuted,
        hintStyle: const TextStyle(
          color: AppPalette.textMuted,
          fontWeight: FontWeight.w600,
        ),
        labelStyle: const TextStyle(
          color: AppPalette.textSecondary,
          fontWeight: FontWeight.w700,
        ),
        prefixIconColor: AppPalette.textMuted,
        suffixIconColor: AppPalette.textMuted,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: AppPalette.lineSoft),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(20),
          borderSide: const BorderSide(color: AppPalette.primary, width: 1.2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 18,
          vertical: 16,
        ),
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppPalette.primary,
        circularTrackColor: AppPalette.smoke,
        linearTrackColor: AppPalette.lineSoft,
      ),
    );
  }

  static ThemeData get light {
    final base = ThemeData.light(useMaterial3: true);
    return base.copyWith(
      colorScheme: base.colorScheme.copyWith(primary: AppPalette.primary),
    );
  }
}
