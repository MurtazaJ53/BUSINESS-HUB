#!/bin/bash

# Script to replace hardcoded colors with AppPalette references in Flutter mobile app
# Run from project root: bash scripts/update_mobile_colors.sh

MOBILE_DIR="apps/mobile_flutter/lib/features"

echo "Updating mobile app colors to use new design system..."

# Replace old palette references with new ones
find "$MOBILE_DIR" -name "*.dart" -type f -exec sed -i \
  -e 's/AppPalette\.backgroundAlt/AppPalette.backgroundSoft/g' \
  -e 's/AppPalette\.panel\b/AppPalette.surface/g' \
  -e 's/AppPalette\.panelStrong/AppPalette.surfaceStrong/g' \
  -e 's/AppPalette\.panelMuted/AppPalette.backgroundSoft/g' \
  -e 's/AppPalette\.line\b/AppPalette.border/g' \
  -e 's/AppPalette\.lineSoft/AppPalette.borderSoft/g' \
  -e 's/AppPalette\.textMuted/AppPalette.textTertiary/g' \
  -e 's/AppPalette\.gold/AppPalette.warning/g' \
  -e 's/AppPalette\.jade/AppPalette.success/g' \
  -e 's/AppPalette\.coral/AppPalette.error/g' \
  -e 's/AppPalette\.cobalt/AppPalette.info/g' \
  -e 's/AppPalette\.smoke/AppPalette.backgroundDeep/g' \
  -e 's/AppPalette\.primaryDeep/AppPalette.primaryDark/g' \
  {} +

# Replace common hardcoded colors with semantic palette colors
find "$MOBILE_DIR" -name "*.dart" -type f -exec sed -i \
  -e 's/Color(0xFFE58A47)/AppPalette.primary/g' \
  -e 's/Color(0xFFB45F28)/AppPalette.primaryDark/g' \
  -e 's/Color(0xFFF0C879)/AppPalette.warning/g' \
  -e 's/Color(0xFF4EB79B)/AppPalette.success/g' \
  -e 's/Color(0xFFEF6B67)/AppPalette.error/g' \
  -e 's/Color(0xFF7CA4F8)/AppPalette.info/g' \
  -e 's/Color(0xFF1D4ED8)/AppPalette.inventory/g' \
  -e 's/Color(0xFF3B82F6)/AppPalette.primary/g' \
  -e 's/Color(0xFF10B981)/AppPalette.success/g' \
  -e 's/Color(0xFFF59E0B)/AppPalette.warning/g' \
  -e 's/Color(0xFFEF4444)/AppPalette.error/g' \
  -e 's/Color(0xFF8B5CF6)/AppPalette.customer/g' \
  {} +

echo "Mobile color update complete!"
echo "Run 'flutter analyze' to check for any issues."
