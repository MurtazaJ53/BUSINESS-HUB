# Business Hub Admin Web

This app is the new Next.js admin shell for Phase 1 of the Business Hub platform rebuild. It focuses on proving the Django backend contract with a premium admin surface before deeper cutover work begins.

## Current scope

- session bootstrap against `/api/v1/session/`
- shop membership scope against `/api/v1/shops/`
- inventory overview against `/api/v1/shops/<shop_id>/inventory/`
- customer overview against `/api/v1/shops/<shop_id>/customers/`
- expense overview against `/api/v1/shops/<shop_id>/expenses/`
- attendance overview against `/api/v1/shops/<shop_id>/attendance/`
- migration control registry against `/api/v1/migration/domains/`
- migration job visibility against `/api/v1/migration/jobs/`
- reconciliation queue visibility against `/api/v1/migration/reconciliation/`
- premium dark command-center UI aligned with Business Hub styling

## Local development

1. Copy `.env.example` to `.env.local`
2. Start the Django backend on port `8000`
3. Start the admin shell:

```bash
pnpm dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

```bash
BUSINESS_HUB_API_BASE_URL=http://127.0.0.1:8000/api/v1
BUSINESS_HUB_DEV_USER_EMAIL=owner@businesshub.local
BUSINESS_HUB_DEV_USER_NAME=Business Hub Owner
BUSINESS_HUB_DEV_PLATFORM_ADMIN=true
```

The dev header values are only for local Phase 1 testing.

## Verification

```bash
pnpm lint
pnpm build
```

## Planned next slices

- search and filter controls backed by query params
- stock adjustment actions
- customer ledger actions, expense entry actions, attendance actions, and settings domains
- real auth handoff beyond local dev headers
