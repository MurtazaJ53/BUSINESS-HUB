# Business Hub Product Overview

## What Business Hub is

Business Hub is a local-first retail operations platform for small and medium shops.

It combines:
- point of sale
- inventory management
- customer tracking
- expense tracking
- staff and attendance management
- dashboard analytics
- backup and operational tooling

The long-term direction is:
- web/admin for broader operations
- Flutter mobile for smooth native field use
- Firebase cloud sync for shared data and recovery

## Product vision

Business Hub should feel like a shop command center:
- fast at opening
- reliable when internet is weak
- safe for real business data
- powerful enough for owners
- simple enough for staff

## Core value proposition

Business Hub exists to help a shop do five things well:

1. Sell quickly
2. Know stock accurately
3. Track who owes what
4. Understand daily business performance
5. Keep operations safe and recoverable

## Main product surfaces

### 1. Dashboard

Purpose:
- quick business pulse
- revenue
- stock status
- critical alerts
- operational shortcuts

### 2. POS / Sales Hub

Purpose:
- product lookup
- cart and billing
- payment collection
- forced sale handling
- receipt flow

### 3. Inventory

Purpose:
- browse catalog
- monitor stock
- categorize items
- track valuation
- identify low-stock risk

### 4. Customers

Purpose:
- store customer profile
- track total spend
- track credit and payments
- improve follow-up

### 5. History / Reports

Purpose:
- view past sales
- track trends
- support reconciliation
- help owner decision making

### 6. Team / Attendance

Purpose:
- manage staff roles
- track attendance
- support payroll-adjacent views
- manage permissions

### 7. Security / Settings / Backup

Purpose:
- store-level configuration
- secure credentials and admin flows
- local and cloud recovery posture

## Primary users

### Owner

Needs:
- full control
- inventory cost visibility
- team management
- analytics access
- security and backup control

### Admin / manager

Needs:
- near-owner operating power
- staff control
- sales control
- stock management

### Staff / cashier

Needs:
- fast POS
- only the screens needed for their role
- minimal friction

## Product principles

1. Local-first speed
2. Cloud-backed recovery
3. Permission-aware access
4. Mobile performance matters
5. Business correctness before visual polish
6. Operational clarity over technical complexity

## Current product state

### Stable / mature

- web/admin operations
- broad local-first data model
- Firebase backend integration
- core retail flows in old app stack

### Improving / migration stage

- Flutter mobile shell
- Flutter dashboard
- Flutter inventory
- Flutter POS
- mobile sync bootstrap

### Not yet complete in Flutter

- full customers parity
- full reports/history parity
- full team/settings parity
- broader sync coverage
- final production cutover readiness

## Success metrics

Business Hub should be considered successful when:
- POS opens quickly on mobile
- inventory scrolling feels smooth on large catalogs
- the same sale appears correctly across devices
- staff only see what they are allowed to see
- the owner can recover operations after outages or device changes

## Current strategic direction

Short-term:
- keep web/admin stable
- improve Flutter mobile until it is truly deployable

Mid-term:
- make Flutter mobile the main mobile app
- finish sync and feature parity

Long-term:
- maintain a strong split between:
  - web/admin operations
  - mobile field execution
