import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Brand + semantic colours shared across light and dark themes.
///
/// Neutral/surface/text tokens default to the **dark** palette so that the
/// many existing screens referencing `AppPalette.surface` etc. keep their
/// current look. Light-mode surfaces live in [AppPaletteLight]; redesigned
/// screens should prefer `Theme.of(context).colorScheme` so they adapt to both.
final class AppPalette {
  // Neutrals (Foundation) — dark
  static const Color backgroundDeep = Color(0xFF070B12);
  static const Color background = Color(0xFF0B111A);
  static const Color backgroundSoft = Color(0xFF111827);
  static const Color surface = Color(0xFF172033);
  static const Color surfaceStrong = Color(0xFF1E293B);
  static const Color borderSoft = Color(0xFF263244);
  static const Color border = Color(0xFF334155);
  static const Color borderStrong = Color(0xFF475569);

  // Text Hierarchy — dark
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFFCBD5E1);
  static const Color textTertiary = Color(0xFF94A3B8);
  static const Color textDisabled = Color(0xFF64748B);

  // Brand Colors (shared)
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryHover = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFF60A5FA);
  static const Color primaryDark = Color(0xFF1E40AF);

  static const Color accent = Color(0xFF8B5CF6);
  static const Color accentHover = Color(0xFF7C3AED);
  static const Color accentLight = Color(0xFFA78BFA);

  // Semantic Colors (shared)
  static const Color success = Color(0xFF10B981);
  static const Color successLight = Color(0xFF34D399);
  static const Color successDark = Color(0xFF059669);

  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFBBF24);
  static const Color warningDark = Color(0xFFD97706);

  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFF87171);
  static const Color errorDark = Color(0xFFDC2626);

  static const Color info = Color(0xFF06B6D4);
  static const Color infoLight = Color(0xFF22D3EE);
  static const Color infoDark = Color(0xFF0891B2);

  // Domain Colors (shared)
  static const Color revenue = Color(0xFF10B981);
  static const Color expense = Color(0xFFEF4444);
  static const Color inventory = Color(0xFF3B82F6);
  static const Color customer = Color(0xFF8B5CF6);
  static const Color alert = Color(0xFFF59E0B);

  // Backward-compatible aliases used across existing screens.
  static const Color panel = surface;
  static const Color lineSoft = borderSoft;
  static const Color coral = error;
}

/// Light-mode neutral/surface/text tokens. Brand + semantic colours are reused
/// from [AppPalette].
final class AppPaletteLight {
  static const Color background = Color(0xFFF6F8FB);
  static const Color backgroundSoft = Color(0xFFEEF2F7);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceStrong = Color(0xFFF1F5F9);
  static const Color borderSoft = Color(0xFFE2E8F0);
  static const Color border = Color(0xFFCBD5E1);
  static const Color borderStrong = Color(0xFF94A3B8);

  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF334155);
  static const Color textTertiary = Color(0xFF64748B);
  static const Color textDisabled = Color(0xFF94A3B8);
}

/// Internal bundle of mode-specific tokens fed into the shared theme builder.
class _ThemeTokens {
  const _ThemeTokens({
    required this.brightness,
    required this.background,
    required this.backgroundSoft,
    required this.surface,
    required this.surfaceStrong,
    required this.borderSoft,
    required this.border,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textDisabled,
  });

  final Brightness brightness;
  final Color background;
  final Color backgroundSoft;
  final Color surface;
  final Color surfaceStrong;
  final Color borderSoft;
  final Color border;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textDisabled;
}

final class AppTheme {
  static ThemeData get dark => _build(
        const _ThemeTokens(
          brightness: Brightness.dark,
          background: AppPalette.background,
          backgroundSoft: AppPalette.backgroundSoft,
          surface: AppPalette.surface,
          surfaceStrong: AppPalette.surfaceStrong,
          borderSoft: AppPalette.borderSoft,
          border: AppPalette.border,
          textPrimary: AppPalette.textPrimary,
          textSecondary: AppPalette.textSecondary,
          textTertiary: AppPalette.textTertiary,
          textDisabled: AppPalette.textDisabled,
        ),
      );

  static ThemeData get light => _build(
        const _ThemeTokens(
          brightness: Brightness.light,
          background: AppPaletteLight.background,
          backgroundSoft: AppPaletteLight.backgroundSoft,
          surface: AppPaletteLight.surface,
          surfaceStrong: AppPaletteLight.surfaceStrong,
          borderSoft: AppPaletteLight.borderSoft,
          border: AppPaletteLight.border,
          textPrimary: AppPaletteLight.textPrimary,
          textSecondary: AppPaletteLight.textSecondary,
          textTertiary: AppPaletteLight.textTertiary,
          textDisabled: AppPaletteLight.textDisabled,
        ),
      );

  static ThemeData _build(_ThemeTokens t) {
    final isDark = t.brightness == Brightness.dark;
    final base = isDark
        ? ThemeData.dark(useMaterial3: true)
        : ThemeData.light(useMaterial3: true);

    final scheme = ColorScheme(
      brightness: t.brightness,
      primary: AppPalette.primary,
      onPrimary: const Color(0xFFFFFFFF),
      secondary: AppPalette.accent,
      onSecondary: const Color(0xFFFFFFFF),
      tertiary: AppPalette.info,
      onTertiary: const Color(0xFFFFFFFF),
      error: AppPalette.error,
      onError: const Color(0xFFFFFFFF),
      surface: t.surface,
      onSurface: t.textPrimary,
      outline: t.border,
      surfaceContainerHighest: t.surfaceStrong,
      secondaryContainer: t.backgroundSoft,
      tertiaryContainer: t.background,
    );

    return base.copyWith(
      extensions: <ThemeExtension<dynamic>>[
        isDark ? AppColors.dark : AppColors.light,
      ],
      scaffoldBackgroundColor: t.background,
      colorScheme: scheme,
      canvasColor: t.backgroundSoft,
      splashColor: AppPalette.primary.withValues(alpha: 0.12),
      highlightColor: AppPalette.primaryLight.withValues(alpha: 0.08),
      dividerColor: t.borderSoft,
      textTheme: base.textTheme
          .apply(bodyColor: t.textPrimary, displayColor: t.textPrimary)
          .copyWith(
            displayLarge: base.textTheme.displayLarge?.copyWith(
              fontSize: 32,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
              height: 1.1,
            ),
            displayMedium: base.textTheme.displayMedium?.copyWith(
              fontSize: 28,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              height: 1.15,
            ),
            displaySmall: base.textTheme.displaySmall?.copyWith(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.2,
              height: 1.2,
            ),
            headlineLarge: base.textTheme.headlineLarge?.copyWith(
              fontSize: 22,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
              height: 1.25,
            ),
            headlineMedium: base.textTheme.headlineMedium?.copyWith(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
              height: 1.3,
            ),
            headlineSmall: base.textTheme.headlineSmall?.copyWith(
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
              height: 1.35,
            ),
            titleLarge: base.textTheme.titleLarge?.copyWith(
              fontSize: 17,
              fontWeight: FontWeight.w600,
              letterSpacing: 0,
              height: 1.4,
            ),
            titleMedium: base.textTheme.titleMedium?.copyWith(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
              height: 1.4,
            ),
            titleSmall: base.textTheme.titleSmall?.copyWith(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.1,
              height: 1.4,
            ),
            bodyLarge: base.textTheme.bodyLarge?.copyWith(
              fontSize: 16,
              color: t.textSecondary,
              fontWeight: FontWeight.w400,
              letterSpacing: 0.2,
              height: 1.5,
            ),
            bodyMedium: base.textTheme.bodyMedium?.copyWith(
              fontSize: 15,
              color: t.textSecondary,
              fontWeight: FontWeight.w400,
              letterSpacing: 0.2,
              height: 1.5,
            ),
            bodySmall: base.textTheme.bodySmall?.copyWith(
              fontSize: 14,
              color: t.textTertiary,
              fontWeight: FontWeight.w400,
              letterSpacing: 0.2,
              height: 1.5,
            ),
            labelLarge: base.textTheme.labelLarge?.copyWith(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
            labelMedium: base.textTheme.labelMedium?.copyWith(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.3,
            ),
            labelSmall: base.textTheme.labelSmall?.copyWith(
              fontSize: 12,
              color: t.textTertiary,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.4,
            ),
          ),
      cardTheme: CardThemeData(
        color: t.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: t.borderSoft, width: 1),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: t.surfaceStrong,
        contentTextStyle: TextStyle(
          color: t.textPrimary,
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
        elevation: 8,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: t.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        elevation: 16,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: t.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 24,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: t.background,
        elevation: 0,
        centerTitle: false,
        foregroundColor: t.textPrimary,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
          color: t.textPrimary,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppPalette.primary,
          foregroundColor: const Color(0xFFFFFFFF),
          disabledBackgroundColor: t.surfaceStrong,
          disabledForegroundColor: t.textDisabled,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: t.textPrimary,
          side: BorderSide(color: t.border, width: 1),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppPalette.primary,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w500,
            letterSpacing: 0.3,
          ),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: t.surfaceStrong,
        selectedColor: AppPalette.primary.withValues(alpha: 0.2),
        side: BorderSide(color: t.borderSoft, width: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        labelStyle: TextStyle(
          color: t.textSecondary,
          fontWeight: FontWeight.w500,
          fontSize: 13,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: t.surface,
        hintStyle: TextStyle(
          color: t.textTertiary,
          fontWeight: FontWeight.w400,
          fontSize: 15,
        ),
        labelStyle: TextStyle(
          color: t.textSecondary,
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
        prefixIconColor: t.textTertiary,
        suffixIconColor: t.textTertiary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: t.borderSoft, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: t.borderSoft, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppPalette.primary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppPalette.error, width: 1),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppPalette.error, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 12,
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(
        color: AppPalette.primary,
        circularTrackColor: t.borderSoft,
        linearTrackColor: t.borderSoft,
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppPalette.primary,
        foregroundColor: Color(0xFFFFFFFF),
        elevation: 4,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: t.surface,
        indicatorColor: AppPalette.primary.withValues(alpha: 0.2),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppPalette.primary,
            );
          }
          return TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: t.textTertiary,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppPalette.primary, size: 24);
          }
          return IconThemeData(color: t.textTertiary, size: 24);
        }),
      ),
    );
  }
}
