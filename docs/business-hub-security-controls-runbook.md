# Business Hub Security Controls Runbook

## Purpose

This runbook explains the current owner/admin security controls now available across Business Hub.

It covers:
- MFA for sensitive owner/admin surfaces
- workspace session control and remote wipe
- workspace device trust scoring
- workspace audit review
- passkey / WebAuthn enrollment and verification

## Current security controls

### 1. MFA for owner/admin controls

Business Hub now requires MFA before sensitive owner/admin surfaces can open.
Owner/admin users can satisfy that requirement with either:
- TOTP authenticator codes
- passkeys / WebAuthn

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

### 3. Workspace device trust scoring

Workspace sessions now carry a trust posture:
- `trusted`
- `review`
- `risky`
- `blocked`

Trust scoring currently considers:
- recent check-in freshness
- release/version hygiene
- package identity presence
- remote wipe / revoke state
- owner/admin second-factor enrollment
- device integrity metadata when provided

Risky device posture now feeds the owner/admin pulse desk automatically so device trust issues become actionable tasks, not hidden session details.

### 4. Workspace audit

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

Recent control activity now also feeds the owner/admin pulse desk automatically.

That includes:
- bursts of session revoke / restore / wipe actions
- heavy team/access-control churn
- ownership transfer follow-up pressure

## Admin web operator flow

### Security setup

1. Open `Security`.
2. Choose one of these setup paths:
   - enroll TOTP with an authenticator app
   - register a passkey on the current browser/device
3. Complete the first verification step.
4. Re-open any protected surface and refresh the MFA window when needed.

### Passkey setup notes

- Set `BUSINESS_HUB_WEBAUTHN_RP_ID` to the effective relying-party host for the admin web deployment.
- Set `BUSINESS_HUB_WEBAUTHN_ALLOWED_ORIGINS` to the exact HTTPS origins that will open the passkey flow.
- Use the default local values only for localhost development.
- Owners/admins can register multiple passkeys and remove old ones from `Security`.

### Sessions response

Use `Sessions` when:
- a device is lost
- a staff member leaves
- a shop device should be blocked immediately
- you want to force a clean re-login
- you want to review which devices are trusted, which only need review, and which are risky

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
- register or verify a passkey-backed secure-access window through the backend session
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
- full WebAuthn resident-key / platform-specific trust policy controls
- stronger device attestation / integrity enforcement

## Related docs

- [D:/business-hub/docs/business-hub-role-based-screen-map.md](D:/business-hub/docs/business-hub-role-based-screen-map.md)
- [D:/business-hub/docs/business-hub-support-playbook.md](D:/business-hub/docs/business-hub-support-playbook.md)
- [D:/business-hub/docs/business-hub-go-live-scorecard.md](D:/business-hub/docs/business-hub-go-live-scorecard.md)
