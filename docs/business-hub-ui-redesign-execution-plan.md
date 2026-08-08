# Business Hub UI Redesign Execution Plan

## Purpose

This document defines how to redesign the Business Hub UI so it matches the curated product strategy.

This is not cosmetic cleanup only.

The redesign exists to prevent Business Hub from feeling like:

- a cluttered ERP shell
- an admin-heavy system
- a dense technical product
- a confusing small-screen experience

## Design objective

Business Hub should feel like:

- premium
- simple
- fast
- focused
- role-aware
- comfortable on small screens

## What needs to change

The current risk is not just "ugly UI."

The deeper risk is:

- too many concepts visible at once
- heavy operational text
- support/internal tools leaking into normal product paths
- inconsistent hierarchy across screens
- mobile layouts consuming too much vertical space

## Redesign workstreams

1. Navigation redesign
2. Role-based visibility redesign
3. Mobile screen simplification
4. Admin web visual cleanup
5. Shared component system cleanup
6. Performance-aware UI polish

## Priority order

## Priority 1: Mobile core journeys

These must be redesigned first:

- Home
- POS
- Inventory
- Customers
- History
- Settings

Because these define the product feel for normal users.

## Priority 2: Owner and manager views

- dashboard summary
- due collections
- expense summary
- operational alerts

## Priority 3: Hidden advanced areas

- reports
- suppliers
- purchases
- internal ops tools

These should only be redesigned after the normal product experience is clean.

## Screen-by-screen direction

## 1. Home

### Current risk

- can become too dashboard-like
- too many cards compete equally
- not enough immediate business clarity

### Target

Home should answer:

- how much did we sell
- who owes us
- what is low in stock
- what needs attention

### Design rules

- short top header
- one quick summary strip
- 3 to 5 core signals max
- 2 to 4 quick actions
- recent receipts or urgent items below

## 2. POS

### Current risk

- must not inherit admin or reporting clutter

### Target

POS should be the cleanest and fastest screen in the whole product.

### Design rules

- large search
- obvious scanner action
- clear cart hierarchy
- bold total area
- very simple checkout action
- minimal descriptive text

## 3. Inventory

### Current risk

- too much list density or too many secondary controls

### Target

Inventory should feel like:

- search
- scan
- quick stock understanding

### Design rules

- search first
- compact category chips
- stock status easy to read
- low-stock emphasis without visual drama

## 4. Customers

### Current risk

- too much ledger-style or accounting-style complexity

### Target

Customers should center on:

- lookup
- due balance
- payment collection
- recent relationship context

### Design rules

- list first
- due amount visually important
- quick collect action
- owner detail deeper, cashier detail lighter

## 5. History

### Current risk

- becoming a complex report-builder screen

### Target

History should feel like a clean transaction feed.

### Design rules

- recent receipts first
- simple filters
- receipt detail strong and readable
- advanced analytics hidden or owner-only

## 6. Settings

### Current risk

- acting like a technical control room

### Target

Settings should feel safe and lightweight.

### Design rules

- store identity
- app and sync summary
- logout
- simple preferences

Advanced ops must be:

- hidden
- separated
- role-gated

## Admin web redesign direction

## Owner / manager admin web

Should feel like:

- structured
- premium
- business-first
- less dense than traditional ERP systems

### Main rules

- fewer top-level sections
- stronger section hierarchy
- simpler summaries
- fewer exposed internal metrics

## Internal admin web

Support and platform tools can be more operationally dense, but they must be visually and navigationally separated from client-facing product areas.

## Navigation redesign plan

## Mobile navigation target

### Starter

- Home
- POS
- Inventory
- Customers
- History
- Settings

### Growth

- Home
- POS
- Inventory
- Customers
- History
- Expenses or Attendance depending priority
- Settings

### Pro

- Home
- POS
- Inventory
- Customers
- History
- Reports
- Settings

Avoid adding everything at once.

## Admin web navigation target

### Client-facing owner/manager web

- Dashboard
- Inventory
- Customers
- Sales
- Payments
- Expenses
- Attendance
- Reports
- Settings

### Internal-only web

- ERP control
- migration
- support diagnostics
- feature flags
- integration controls

## Shared design system requirements

The redesign should create consistency across:

- card radius
- spacing rhythm
- section headers
- action placement
- status badges
- typography scale

## Performance-aware design rules

Because UI quality is not just visual:

- avoid oversized hero blocks
- avoid extra wrapper layers that add no hierarchy value
- avoid loading large panels eagerly when hidden
- reduce rebuild-heavy dashboard sections
- prefer shorter screens with clearer focus

## Delivery plan

## Week A: Information architecture pass

- finalize role-based screen map
- finalize mobile and web navigation
- confirm hidden/internal split

## Week B: UX wireframe pass

- wireframe Home
- wireframe POS
- wireframe Inventory
- wireframe Customers
- wireframe History
- wireframe Settings

## Week C: Shared design system pass

- refine spacing
- card system
- typography scale
- button hierarchy
- status language

## Week D: Mobile implementation pass

- implement new mobile shell/navigation
- implement redesigned Home
- implement redesigned POS
- simplify Settings

## Week E: Admin web implementation pass

- align owner/manager admin web with curated product shape
- separate internal surfaces from client-facing surfaces

## Week F: Polish and performance pass

- trim text density
- remove redundant surfaces
- optimize slow rebuild zones
- check small-screen behavior

## Hard rules for the redesign

1. No raw ERP terminology in normal client flows.
2. No support/control-plane visuals in normal client flows.
3. No giant decorative sections that delay useful content.
4. No screen should try to satisfy cashier, owner, and support admin at the same time.
5. Mobile simplicity is more important than feature exposure.

## Acceptance criteria

The redesign is successful when:

- cashier journey feels fast and obvious
- owner journey feels clear but not dense
- manager journey feels practical
- internal tools remain available without contaminating the product
- Business Hub looks like a premium retail product, not a hidden ERP shell with custom colors
