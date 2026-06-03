import 'package:flutter/material.dart';

final class AppPalette {
  // Neutrals (Foundation)
  static const Color backgroundDeep = Color(0xFF070B12);
  static const Color background = Color(0xFF0B111A);
  static const Color backgroundSoft = Color(0xFF111827);
  static const Color surface = Color(0xFF172033);
  static const Color surfaceStrong = Color(0xFF1E293B);
  static const Color borderSoft = Color(0xFF263244);
  static const Color border = Color(0xFF334155);
  static const Color borderStrong = Color(0xFF475569);

  // Text Hierarchy
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFFCBD5E1);
  static const Color textTertiary = Color(0xFF94A3B8);
  static const Color textDisabled = Color(0xFF64748B);

  // Brand Colors
  static const Color primary = Color(0xFF3B82F6);
  static const Color primaryHover = Color(0xFF2563EB);
  static const Color primaryLight = Color(0xFF60A5FA);
  static const Color primaryDark = Color(0xFF1E40AF);

  static const Color accent = Color(0xFF8B5CF6);
  static const Color accentHover = Color(0xFF7C3AED);
  static const Color accentLight = Color(0xFFA78BFA);

  // Semantic Colors
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

  // Domain Colors
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

final class AppTheme {
  static ThemeData get dark {
    final base = ThemeData.dark(useMaterial3: true);
    final scheme = const ColorScheme.dark(
      primary: AppPalette.primary,
      secondary: AppPalette.accent,
      tertiary: AppPalette.info,
      error: AppPalette.error,
      surface: AppPalette.surface,
      onPrimary: Color(0xFFFFFFFF),
      onSecondary: Color(0xFFFFFFFF),
      onTertiary: Color(0xFFFFFFFF),
      onSurface: AppPalette.textPrimary,
      onError: Color(0xFFFFFFFF),
      outline: AppPalette.border,
      surfaceContainerHighest: AppPalette.surfaceStrong,
      secondaryContainer: AppPalette.backgroundSoft,
      tertiaryContainer: AppPalette.backgroundDeep,
    );

    return base.copyWith(
      scaffoldBackgroundColor: AppPalette.background,
      colorScheme: scheme,
      canvasColor: AppPalette.backgroundSoft,
      splashColor: AppPalette.primary.withValues(alpha: 0.12),
      highlightColor: AppPalette.primaryLight.withValues(alpha: 0.08),
      dividerColor: AppPalette.borderSoft,
      textTheme: base.textTheme
          .apply(
            bodyColor: AppPalette.textPrimary,
            displayColor: AppPalette.textPrimary,
          )
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
              color: AppPalette.textSecondary,
              fontWeight: FontWeight.w400,
              letterSpacing: 0.2,
              height: 1.5,
            ),
            bodyMedium: base.textTheme.bodyMedium?.copyWith(
              fontSize: 15,
              color: AppPalette.textSecondary,
              fontWeight: FontWeight.w400,
              letterSpacing: 0.2,
              height: 1.5,
            ),
            bodySmall: base.textTheme.bodySmall?.copyWith(
              fontSize: 14,
              color: AppPalette.textTertiary,
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
              color: AppPalette.textTertiary,
              fontWeight: FontWeight.w500,
              letterSpacing: 0.4,
            ),
          ),
      cardTheme: CardThemeData(
        color: AppPalette.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: AppPalette.borderSoft, width: 1),
        ),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppPalette.surfaceStrong,
        contentTextStyle: const TextStyle(
          color: AppPalette.textPrimary,
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        behavior: SnackBarBehavior.floating,
        elevation: 8,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppPalette.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        elevation: 16,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppPalette.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 24,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppPalette.background,
        elevation: 0,
        centerTitle: false,
        foregroundColor: AppPalette.textPrimary,
        titleTextStyle: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.1,
          color: AppPalette.textPrimary,
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: AppPalette.primary,
          foregroundColor: const Color(0xFFFFFFFF),
          disabledBackgroundColor: AppPalette.surfaceStrong,
          disabledForegroundColor: AppPalette.textDisabled,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
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
          foregroundColor: AppPalette.textPrimary,
          side: const BorderSide(color: AppPalette.border, width: 1),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
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
        backgroundColor: AppPalette.surfaceStrong,
        selectedColor: AppPalette.primary.withValues(alpha: 0.2),
        side: const BorderSide(color: AppPalette.borderSoft, width: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        labelStyle: const TextStyle(
          color: AppPalette.textSecondary,
          fontWeight: FontWeight.w500,
          fontSize: 13,
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppPalette.surface,
        hintStyle: const TextStyle(
          color: AppPalette.textTertiary,
          fontWeight: FontWeight.w400,
          fontSize: 15,
        ),
        labelStyle: const TextStyle(
          color: AppPalette.textSecondary,
          fontWeight: FontWeight.w500,
          fontSize: 14,
        ),
        prefixIconColor: AppPalette.textTertiary,
        suffixIconColor: AppPalette.textTertiary,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppPalette.borderSoft, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppPalette.borderSoft, width: 1),
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
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppPalette.primary,
        circularTrackColor: AppPalette.borderSoft,
        linearTrackColor: AppPalette.borderSoft,
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
        backgroundColor: AppPalette.surface,
        indicatorColor: AppPalette.primary.withValues(alpha: 0.2),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppPalette.primary,
            );
          }
          return const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppPalette.textTertiary,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return const IconThemeData(color: AppPalette.primary, size: 24);
          }
          return const IconThemeData(color: AppPalette.textTertiary, size: 24);
        }),
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
