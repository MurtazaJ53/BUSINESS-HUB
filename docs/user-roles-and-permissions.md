# Business Hub User Roles and Permissions

## Purpose

This document explains the functional role model used across Business Hub.

The actual enforcement currently comes from:
- Firebase Auth claims
- Firestore rules
- `shops/{shopId}/staff/{uid}` role
- `shops/{shopId}/staff/{uid}` permission matrix

## Role overview

### Owner

Typical meaning:
- the person who owns the shop
- usually maps to admin-level control
- may also be recovered from shop ownership if claims are missing

Capabilities:
- full shop control
- settings control
- full sales/inventory/team visibility
- private/cost data control

### Admin

Typical meaning:
- highest operational role inside the app
- can manage staff and sensitive modules

Capabilities usually include:
- inventory view/create/edit/delete
- cost visibility
- sales view/create/edit/void
- customer access
- team access
- settings access

### Manager

Typical meaning:
- intermediate role
- operational authority without full owner/admin power

Exact permissions:
- should be defined by the permission matrix
- may differ by shop

### Staff

Typical meaning:
- cashier / operational user
- limited access based on granted modules

Typical allowed areas:
- POS
- some inventory visibility
- some customer handling

### Suspended

Meaning:
- blocked account
- should not operate inside Business Hub

## Permission modules

The current rule system references these module groups:

- inventory
- sales
- customers
- expenses
- team
- analytics
- settings

## Common permission actions

Depending on module, actions include:

- view
- create
- edit
- delete
- view_cost
- void_sale
- view_profit
- override_price

## Important rule behavior

### Inventory

- `inventory_private` read requires `inventory.view_cost`
- delete requires elevated authority

### Sales

- sale creation requires create permission
- discount override is validated
- delete/void requires stronger permission

### Team

- staff documents are admin-controlled
- private staff docs are admin-only

### Invitations / jobs / imports

- admin-only

## Practical meaning for product behavior

### Owner/admin can usually:
- see cost and profit
- manage staff
- manage imports
- handle sensitive settings

### Staff should usually:
- use POS
- see only allowed operational screens
- avoid cost/private/security views

## Current mobile migration note

The Flutter app currently recovers:
- owner context
- admin context
- staff membership context

But feature parity is still incomplete, so permissions may be technically resolved before every UI flow is fully migrated.

## Recommendation

Before full mobile cutover:
- define a canonical permission matrix
- document expected screens per role
- test owner/admin/staff separately on Flutter mobile
