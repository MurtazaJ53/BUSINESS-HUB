# Business Hub Security Controls Runbook

## Purpose

This runbook explains the current owner/admin security controls now available across Business Hub.

It covers:
- MFA for sensitive owner/admin surfaces
- workspace session control and remote wipe
- workspace audit review

## Current security controls

### 1. MFA for owner/admin controls

Business Hub now requires MFA before sensitive owner/admin surfaces can open.

Protected surfaces include:
- Workspace plan
- Workspace team
- Workspace sessions
- Workspace audit
- Payments review
- ERPNext internal controls
- Migration internal controls
- Mobile Advanced ops
- Mobile Workspace plan compare

### 2. Workspace session control

Owner/admin users can now review active workspace sessions and take action when a device is lost or should be blocked.

Available actions:
- revoke session
- restore session
- revoke and wipe

When a mobile device receives a wipe request, the local workspace data is cleared and the user is signed out.

### 3. Workspace audit

Owner/admin users can now review append-only audit events for important workspace changes.

Audited areas currently include:
- plan requests
- team changes
- ownership transfer
- inventory changes
- stock adjustments
- customer changes
- ledger changes
- sale creation/acceptance
- payment acceptance

## Admin web operator flow

### Security setup

1. Open `Security`.
2. Start MFA setup.
3. Add the secret to an authenticator app.
4. Verify the first code.
5. Re-open any protected surface and refresh the MFA window when needed.

### Sessions response

Use `Sessions` when:
- a device is lost
- a staff member leaves
- a shop device should be blocked immediately
- you want to force a clean re-login

### Audit review

Use `Audit` when:
- cash totals look suspicious
- stock changed unexpectedly
- a role changed and you want to know who did it
- customer/account data was altered

## Mobile operator flow

### Security page

On mobile, owner/admin users can:
- enroll MFA
- refresh the secure-access window
- disable MFA when replacing the authenticator

### Protected mobile surfaces

The mobile app now blocks protected owner/admin pages unless the MFA window is fresh.

That currently applies to:
- Workspace plan
- Advanced ops

## Recommended operating rules

- Require owners and admins to complete MFA enrollment before using advanced controls.
- Revoke and wipe any lost device immediately.
- Review audit history during incident response, not only after the fact.
- Keep staff on non-owner roles unless they truly need management surfaces.

## What is still not included

The current security layer is strong, but it is not the final enterprise endpoint yet.

Still pending:
- WebAuthn / passkey MFA
- anomaly detection on audit and finance events
- automatic security-task generation
- device trust scoring

## Related docs

- [D:/business-hub/docs/business-hub-role-based-screen-map.md](D:/business-hub/docs/business-hub-role-based-screen-map.md)
- [D:/business-hub/docs/business-hub-support-playbook.md](D:/business-hub/docs/business-hub-support-playbook.md)
- [D:/business-hub/docs/business-hub-go-live-scorecard.md](D:/business-hub/docs/business-hub-go-live-scorecard.md)
