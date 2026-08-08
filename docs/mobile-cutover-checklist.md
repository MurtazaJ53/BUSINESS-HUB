# Flutter Mobile Cutover Checklist

## Purpose

This checklist is for the moment when Flutter mobile is considered for full production replacement of the old mobile path.

## Identity and packaging

- final package name decided
- production signing configured
- beta and production install strategy decided
- versioning policy documented

## Authentication

- owner login verified
- admin login verified
- staff login verified
- membership recovery verified
- suspended user handling verified

## Core business parity

- dashboard parity acceptable
- inventory parity acceptable
- POS parity acceptable
- customer parity acceptable
- history parity acceptable
- settings/team parity acceptable

## Data and sync

- first install hydrates correctly
- reinstall hydrates correctly
- sale on mobile appears on web
- sale on web appears on mobile
- low-stock state remains consistent
- sync errors are visible and recoverable

## UX quality

- scrolling is smooth on target phones
- startup is acceptable
- back button behavior is correct
- no major layout regressions
- premium product feel is acceptable

## Operational readiness

- release APK/AAB pipeline verified
- rollback plan documented
- support/troubleshooting path documented
- test sign-off completed

## Final go/no-go rule

Do not cut over if:
- important business flows are still missing
- sync correctness is uncertain
- owners or staff cannot trust the app for live operations
