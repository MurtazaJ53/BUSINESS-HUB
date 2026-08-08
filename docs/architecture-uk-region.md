# Structure blueprint: region layer, money model, India-first

**Standing directives (2026-07-01, latest):**
1. **India-first default** — INR, IST, en-IN, GST, Indian compliance. UK is a
   supported secondary region behind the same layer.
2. **Mobile & tablet only for now** — touch-first; desktop deferred to a later phase.
3. **Flawless DB / relational integrity** — explicit PK/FK, no orphaned data.
4. **Zero-error QA** — frontend ⇄ backend ⇄ DB kept in sync.

Decision: build a **region/locale layer supporting India (default) + UK**, move
money to **integer minor units**, on the **mobile + tablet** surfaces now
(Flutter mobile, React `src/`, Next `admin_web` as a touch admin), desktop later.

This doc is the contract every surface implements. The Flutter app holds the
reference implementation (`core/region/region.dart`, `core/utils/formatters.dart`).

## 1. The core problem

The product is **India-first** today: `Intl.NumberFormat('en-IN', INR)`,
`isValidIndianPhone()`, default `currency:'INR'`, ₹/INR hard-coded in ~40 files
across all surfaces. There is **no tax model at all** (the "VAT" that looked
present was the word "pri**vat**e"). "Make it UK" is therefore a localization +
domain program, not a restyle.

## 2. Region layer (the contract)

One profile drives everything market-specific. Same shape on every surface:

```
RegionProfile {
  region            // 'uk' | 'india'
  currencyCode      // 'GBP' | 'INR'
  currencySymbol    // '£'  | '₹'
  localeTag         // 'en-GB' | 'en-IN'
  grouping          // 'western' (1,234,567) | 'indian' (12,34,567)
  minorUnitDigits   // 2 (GBP) | 0 (INR display)
  taxLabel          // 'VAT' | 'GST'
  taxRates[]        // [Standard 20%, Reduced 5%, Zero 0%] | [GST 18/12/5/0]
  defaultTaxRate
  taxInclusivePricing // true for UK retail
  phonePattern      // UK vs IN validation
}
```

Rules:
- **No surface hard-codes** a symbol, locale, tax rate, or phone regex. They read the active profile.
- One active region per shop, stored on the shop record; default **India**.
- Reference impl: [apps/mobile_flutter/lib/core/region/region.dart](../apps/mobile_flutter/lib/core/region/region.dart).

## 3. Money model — integer minor units

- **Store and compute** money as `int` minor units (pence/paise). Never `double`.
  (The pence-rounding bug came from doubles.)
- **Format only at the edge** via `formatMinor(int)` → `£12.99`.
- Migration: add minor-unit columns/fields alongside existing doubles, backfill
  (`round(amount*100)`), switch reads, then drop the doubles. Per surface:
  - Mobile: drift schema + `mobile_models.dart` money fields → `int`.
  - Web `src/`: `src/db` schema + repositories.
  - Backend: Django `DecimalField`→ integer minor (or `Money` type) + DRF serializers.
- Transport: APIs exchange integer minor units + `currencyCode` (e.g. `{ amount: 1299, currency: 'GBP' }`).

## 4. Tax (VAT) domain — new

- Product carries a `taxRate` (band from the region profile).
- Line item stores net, tax, gross (all minor units).
- Sale stores tax breakdown; receipt shows **net / VAT / gross** + VAT number.
- Reports: VAT summary per period (foundation for HMRC Making Tax Digital later).
- Helpers exist on mobile: `taxFromGross/taxFromNet/netFromGross`.

## 5. Design tokens — one source, three outputs

Stop hand-maintaining three palettes. Define tokens once (colour, spacing, type,
radius) and generate:
- Dart (`AppPalette`/`AppColors`) for mobile + desktop,
- CSS variables for `src/` and `admin_web`.
Mobile already centralises in `core/theme/*`; make that the source, emit web vars.

## 6. Surface plan (mobile + tablet now; desktop later)

| Surface | Stack | Phase | Region work |
|---------|-------|-------|-------------|
| Mobile/tablet | Flutter | **now** | v3 screens live; region wiring, pence migration, GST UI, tablet (master–detail) layouts |
| Web `src/` | React/Vite | **now** (touch) | Region config, replace en-IN formatter with layer, pence, GST, shared tokens, touch-optimized |
| Admin | Next.js | **now** (touch) | `lib/formatters.ts` region-aware, pence, GST columns, shared tokens |
| Desktop | (confirm stack) | **later** | Deferred per directive 2 |

## 7. Sequencing (each step build-verified before the next)

1. **Region layer per surface** (no behaviour change; UK default). ← mobile done
2. **Currency display** swaps to region formatter everywhere (kills ₹ hard-codes).
3. **Money → minor units** migration, surface by surface, with tests.
4. **Tax domain** — GST (default) with VAT supported via the region profile (model → POS → receipt → reports; GSTIN + HSN/SAC on the India profile).
5. **Phone/address/locale** — Indian phone/PIN code by default (keep `isValidIndianPhone`), UK phone/postcode behind the region layer.
6. **Design tokens** unified; finish v3 visual language on all surfaces.
7. **Consolidation**: delete superseded old screens; review `pilot_*` ops sprawl.

## 8. Open questions for you

- **Payments**: which UK rail — Stripe / SumUp / Square / GoCardless? (affects POS + backend)
- **Desktop**: what stack is it, and is it a priority now or later?
- **ERPNext**: stays as the accounting backend, or is VAT handled in-app?
