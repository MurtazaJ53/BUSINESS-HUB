import 'package:business_hub_mobile/core/theme/app_theme.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('dark theme keeps expected premium shell colors', () {
    final theme = AppTheme.dark;

    expect(theme.scaffoldBackgroundColor, AppPalette.background);
    expect(theme.colorScheme.primary, AppPalette.primary);
    expect(theme.cardTheme.color, AppPalette.panel);
  });

  test('light theme keeps business hub primary color', () {
    final theme = AppTheme.light;

    expect(theme.colorScheme.primary, AppPalette.primary);
  });
}
