# Business Hub Role-Based Screen Map

## Purpose

This document translates the product boundary into concrete screen visibility rules by role.

It exists to answer one practical question:

**When a user signs in, exactly what should they see?**

This is the next hard gate after:

- client-facing module matrix
- domain ownership matrix
- plan tier feature matrix
- UI and experience principles

## Roles covered

- Cashier
- Manager
- Owner
- Support Admin
- Platform Admin

## Backend role mapping

The product language and the backend role enum are related, but they are not written the same way everywhere.

### Backend workspace roles

- `viewer`
- `staff`
- `admin`
- `owner`

### Product-facing interpretation

- `staff`:
  day-to-day operator access
  closest to cashier / floor staff
- `admin`:
  store-management access
  closest to manager / store admin
- `owner`:
  business-control access
  closest to workspace owner
- `viewer`:
  read-only lookup and oversight

### Important rule

Role answers:

- who can do the action

Plan answers:

- which product surfaces and deeper capabilities are enabled for that workspace

So:

- an owner on `Starter` still does not get `Pro` capabilities
- a staff user on `Pro` still does not get owner/admin-only surfaces

## Surface types

### Mobile

The primary daily-use execution surface.

### Admin Web

The broader operating surface for management, reporting, and hidden back-office controls.

## Role intent

### Cashier

Primary goal:

- sell fast
- find products
- attach customers
- complete payment
- review recent receipts when needed

### Manager

Primary goal:

- supervise daily operations
- monitor stock
- monitor customers and dues
- record expenses and attendance where enabled

### Owner

Primary goal:

- understand business performance
- review dues and collections
- monitor stock and expenses
- access selected advanced controls by plan

### Support Admin

Primary goal:

- troubleshoot client accounts
- manage internal support flows
- access hidden ops and integration tools safely

### Platform Admin

Primary goal:

- configure platform-level controls
- manage feature flags and integration policy
- access migration, ERP, and system control surfaces

## Mobile screen map

## Cashier mobile

### Default main navigation

- Home
- POS
- Inventory
- Customers
- History

### Allowed screens

- Home
  - today summary
  - quick actions
  - sync status summary only if small and calm
- POS
  - product search
  - barcode
  - cart
  - checkout
  - payment collection
  - customer attach
- Inventory
  - product list
  - stock visibility
  - low-stock visibility
- Customers
  - lookup
  - due balance visibility
  - payment collection actions if permitted
- History
  - recent receipts
  - receipt detail

### Hidden from cashier

- expenses
- attendance management
- staff management
- advanced reports
- supplier views
- purchases
- accounting views
- ERP controls
- migration controls
- sync internals

## Manager mobile

### Default main navigation

- Home
- POS
- Inventory
- Customers
- History
- Expenses if enabled
- Attendance if enabled

### Allowed screens

- everything cashier can see
- expense entry and expense list if plan allows
- attendance list and daily status if plan allows
- stronger stock alerts
- broader customer due visibility

### Hidden from manager by default

- platform settings
- ERP binding
- raw accounting views
- migration tools
- internal ops controls

## Owner mobile

### Default main navigation

- Home
- POS
- Inventory
- Customers
- History
- Expenses if enabled
- Attendance if enabled
- Reports if plan allows
- Settings

### Allowed screens

- everything manager can see
- owner dashboard summary
- due collections summary
- expense summary
- selected advanced reports
- store settings
- backup/recovery posture summary where enabled

### Hidden from owner by default

- raw ERP forms
- technical sync tools
- integration bindings
- migration control plane
- account/tax mappings

## Support Admin mobile

### Recommended posture

Support Admin should not use the normal client mobile app as a primary ops surface unless there is a strong support reason.

If allowed:

- hidden support area
- diagnostic screens
- evidence and recovery tooling

These must never appear in the normal client-facing tab set.

## Platform Admin mobile

### Recommended posture

Platform Admin should not depend on mobile for platform control except for specific support tools.

Primary internal operations should live in admin web.

## Admin web screen map

## Cashier admin web

### Recommended posture

Cashiers should rarely need admin web.

If allowed at all, keep it minimal:

- basic sales history
- maybe customer or receipt lookup

Do not make admin web the normal cashier workflow.

## Manager admin web

### Allowed sections

- dashboard
- workspace team when the account is truly a store-admin role
- workspace audit
- inventory
- customers
- sales/history
- expenses if enabled
- attendance if enabled
- limited reporting

### Hidden from manager

- ERP controls
- migration controls
- feature flag surfaces
- platform-wide settings
- raw finance/admin internals
- ownership transfer

## Owner admin web

### Allowed sections

- dashboard
- workspace team
- workspace audit
- ownership transfer from the workspace team surface
- inventory
- customers
- sales/history
- payments
- expenses
- attendance
- reports
- settings
- selected advanced owner tools by plan

### Optional owner-only gated sections

- supplier overview
- curated purchase overview
- finance summary
- receivables/payables summary

### Hidden from owner by default

- raw ERPNext operational forms
- migration control plane
- technical support diagnostics
- feature flag control
- platform internals

## Support Admin admin web

### Allowed sections

- support tools
- selected ERP operational panels
- recovery / troubleshooting panels
- client environment diagnostics
- issue-resolution screens

### Hidden unless explicitly needed

- platform-wide destructive controls

## Platform Admin admin web

### Allowed sections

- everything internal
- ERP control plane
- migration control plane
- feature flags
- plan/tier management
- integration bindings
- domain ownership operations
- support tooling

## Navigation design implications

## Mobile

### Cashier mobile should feel like:

- POS-first
- fast
- uncluttered
- obvious

### Owner mobile should feel like:

- summary-first
- alert-aware
- powerful but still calm

### Internal tools on mobile should be:

- deeply hidden
- role-gated
- never mixed into the default tab system

## Admin web

### Manager and owner web should feel like:

- operational
- clear
- moderately powerful
- still product-shaped

### Internal web should feel separate

Support and platform administration should have clearly separated internal surfaces so client-facing web UX does not inherit support-tool complexity.

## Default route recommendation by role

### Cashier

- mobile default route: `POS` or `Home` with strong POS shortcut
- web default route: avoid unless explicitly needed

### Manager

- mobile default route: `Home`
- web default route: `Dashboard`

### Owner

- mobile default route: `Home`
- web default route: `Dashboard`

### Support Admin

- web default route: internal support dashboard

### Platform Admin

- web default route: internal control surface

## Screen design rules by role

### Cashier screens

- fewer decisions
- fewer words
- bigger actions
- faster flows

### Manager screens

- operational summaries
- exception handling
- moderate filtering

### Owner screens

- high-value summaries
- business trends
- financial visibility in curated form

### Internal admin screens

- dense if needed
- but separated from client product identity

## Acceptance criteria

- every role has a clear default screen set
- mobile and web exposure are intentionally different by role
- hidden and internal tools stay out of normal owner/cashier journeys
- UI design can now be planned screen-by-screen against a fixed role map
