import 'package:business_hub_mobile/core/theme/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// These assert the intended palette values directly (deterministic, no font
// loading). Building AppTheme.* pulls in google_fonts, which needs network in
// the test sandbox; the brand colours are what actually matter here.
void main() {
  test('brand primary is the Business Hub sky-blue', () {
    expect(AppPalette.primary, const Color(0xFF0EA5E9));
    expect(AppPalette.accent, const Color(0xFF0284C7));
  });

  test('surfaces are light (blue-and-white theme)', () {
    expect(AppPalette.background, const Color(0xFFF8FAFC));
    expect(AppPalette.surface, const Color(0xFFFFFFFF));
    expect(AppPalette.textPrimary, const Color(0xFF0F172A));
  });

  test('semantic money/alert colours are preserved', () {
    expect(AppPalette.success, const Color(0xFF10B981));
    expect(AppPalette.error, const Color(0xFFEF4444));
    expect(AppPalette.warning, const Color(0xFFF59E0B));
  });
}
