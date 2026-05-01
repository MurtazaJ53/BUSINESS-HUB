# Business Hub Terraform Baseline

This folder is the Phase 1 infrastructure-as-code baseline for the new platform.

It is intentionally small right now. The goal is to give the team a versioned home for:

- provider configuration
- environment variables
- state/backend strategy
- future service modules for:
  - backend API
  - PostgreSQL
  - Redis
  - object storage
  - observability

## Current scope

- Terraform version pinning
- AWS provider baseline
- core variables for:
  - environment
  - region
  - service naming
  - network ranges

## Recommended next modules

1. networking
2. postgres
3. redis
4. backend app runtime
5. object storage
6. telemetry/secret wiring

## Suggested Tier A region

- primary region: `ap-south-1` (Mumbai)

That keeps the first production deployment close to current operators while still allowing CDN/WAF edge delivery globally.
