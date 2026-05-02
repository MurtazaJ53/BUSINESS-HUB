import 'package:business_hub_mobile/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('dark theme keeps expected premium shell colors', () {
    final theme = AppTheme.dark;

    expect(theme.scaffoldBackgroundColor, const Color(0xFF05070B));
    expect(theme.colorScheme.primary, const Color(0xFF0EA5E9));
    expect(theme.cardTheme.color, const Color(0xFF10141C));
  });

  test('light theme keeps business hub primary color', () {
    final theme = AppTheme.light;

    expect(theme.colorScheme.primary, const Color(0xFF0EA5E9));
  });
}
