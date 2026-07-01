# Mobile redesign — status & roadmap

Single source of truth for the mobile (Flutter) redesign. Supersedes the
marketing-flavoured `design-*.md` files for day-to-day work.

_Last updated: 2026-06-29_

## Done in this pass

| Area | Change | Files |
|------|--------|-------|
| **v3 wired in** | Router now renders the redesigned screens (were built but orphaned — old screens still showed). | `core/router/app_router.dart` |
| **UK currency** | `formatCurrency` is now GBP: `£`, two-decimal pence (old code rounded pence away — a real retail bug), UK comma grouping. Added `formatCurrencyCompact` and VAT helpers (`vatFromGross`, `vatFromNet`, `netFromGross`, `roundPence`, `formatVatRate`). | `core/utils/formatters.dart` |
| **Real light theme** | `AppTheme.light` was a one-line stub; now a full theme built from the same tokens as dark via a shared `_build`. Added `AppPaletteLight`. | `core/theme/app_theme.dart` |
| **Light/dark per screen** | New `AppColors` `ThemeExtension` resolves neutral surfaces/text per brightness; v3 screens read `AppColors.of(context)` instead of hard-coded dark constants. | `core/theme/app_colors.dart`, all `*_screen_v3.dart` |
| **Follows device** | App theme mode is now `ThemeMode.system` (was hard-locked to dark) with a session override controller. | `core/theme/theme_mode_controller.dart`, `app/app.dart` |
| **Deprecations** | All `withOpacity` (27×, deprecated in Flutter 3.27+) → `withValues(alpha:)`. | v3 files, `premium_components.dart` |
| **No fake data** | Removed the hard-coded `+12%` trend on the dashboard hero. | `dashboard_screen_v3.dart` |
| **Hygiene** | Removed dead `team_old.tsx` (126KB, unimported). | repo root |

## Action required from you (cannot be done safely for you)

1. **Rotate the GCP/Firebase service-account key.** `service-account.json` and
   `business-hub.jks` are gitignored now but were committed in history
   (`64c3fe8`, `d9970b4`). The secret is recoverable from history → revoke +
   reissue the key, and consider purging history with `git filter-repo`.
2. **Run the build** — Flutter isn't on this machine's PATH, so changes are not
   compile-verified:
   ```
   cd apps/mobile_flutter
   flutter pub get
   flutter analyze
   flutter run
   ```
   Check light mode by toggling the OS theme.

## Roadmap (next, in priority order)

1. **Settings theme toggle.** Expose System / Light / Dark. Ready to drop into
   `settings_screen.dart`:
   ```dart
   // import '../../../core/theme/theme_mode_controller.dart';
   final mode = ref.watch(themeModeProvider);
   SegmentedButton<ThemeMode>(
     segments: const [
       ButtonSegment(value: ThemeMode.system, label: Text('Auto')),
       ButtonSegment(value: ThemeMode.light, label: Text('Light')),
       ButtonSegment(value: ThemeMode.dark, label: Text('Dark')),
     ],
     selected: {mode},
     onSelectionChanged: (s) =>
         ref.read(themeModeProvider.notifier).set(s.first),
   )
   ```
2. **Persist the theme choice** to the drift store (today the override is
   session-only; system default survives restarts, a manual override does not).
3. **VAT end-to-end.** Use the new helpers to show net / VAT / gross on POS
   totals and receipts; add a per-item VAT rate (standard 20% / reduced 5% /
   zero) on inventory; VAT summary on reports. Make the currency/VAT layer
   shop-configurable rather than GBP-hardcoded.
4. **Finish the redesign surface.** Apply the v3 visual language + `AppColors`
   tokens to the remaining screens: History, Settings (and sub-screens), Auth
   gate, and the startup/boot screens in `app/app.dart` (still dark-only).
5. **Delete the old screens** (`dashboard_screen.dart`, `pos_screen.dart`,
   `inventory_screen.dart`, `customers_screen.dart`) once v3 is confirmed good —
   they're now unreferenced.
6. **Consolidate docs.** Replace the 10 `design-*.md` marketing docs (invented
   ROI / "+40%" figures) with this file + a real token reference.
7. **One token source across platforms.** Mobile, `src/` web and `admin_web`
   each redefine colours separately. Generate tokens once and consume everywhere.
