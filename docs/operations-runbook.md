# Business Hub Operations Runbook

## Purpose

This document is for day-to-day operational response when something goes wrong in Business Hub.

## Common issue categories

### 1. Login or workspace recovery problems

Symptoms:
- user signs in but no shop loads
- user lands in recovery state
- staff account looks unassigned

Likely causes:
- claims are stale
- `users/{uid}` is missing `shopId`
- staff membership exists but local recovery has not run yet

First checks:
1. verify the user exists in Firebase Auth
2. verify `users/{uid}` exists
3. verify `shops/{shopId}/staff/{uid}` exists if they are staff/admin
4. verify Firestore rules allow the needed reads

### 2. Web shows data but Flutter does not

Likely causes:
- old web local SQLite contains data not yet synced to Firestore
- Flutter does not yet sync that data domain locally
- the Flutter account recovered the wrong or no shop context

First checks:
1. verify Firestore actually contains the missing data
2. verify the affected entity type is supported in Flutter sync
3. verify the user belongs to the correct shop

### 3. Flutter app looks polished but incomplete

Likely cause:
- UI has moved ahead of full feature parity

Action:
- compare requested flow against Sync Parity Matrix
- confirm whether the missing behavior is:
  - absent by design
  - partial
  - broken

### 4. Sales sync issues

Symptoms:
- sale saved locally but not visible elsewhere
- stock mismatch after sale

First checks:
1. verify sale exists in local client state
2. verify sale exists in Firestore `shops/{shopId}/sales`
3. verify stock updates also reached Firestore inventory docs
4. verify permissions on sale creation were valid

### 5. Performance issues

Symptoms:
- slow startup
- laggy scrolling
- delayed inventory/POS screen readiness

Likely causes:
- too much local data shaping on first paint
- missing Flutter parity leading to repeated retries or empty-state work
- old mobile path / WebView overhead if testing wrong app

First checks:
1. verify which app path is under test
2. verify local schema size and sync scope
3. verify target phone class

## Operational dashboards to trust

Right now, the most trustworthy operational truth sources are:
- Firestore data itself
- web/admin app for broader domain coverage
- Flutter mobile only for domains already implemented there

## Incident severity suggestion

### Severity 1

- sales cannot be recorded
- login broken for all users
- cloud data corruption risk

### Severity 2

- a major role cannot access its primary workflow
- sync broken for an important domain

### Severity 3

- UI mismatch
- partial parity gap
- non-critical mobile polish issue

## Recommended operational discipline

1. Always confirm whether issue is:
   - local-only
   - cloud truth
   - parity gap
   - rules problem

2. Never assume web and Flutter are identical yet.

3. Keep old app path available until Flutter cutover is fully signed off.
