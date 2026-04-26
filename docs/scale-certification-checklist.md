# Scale Certification Checklist

## Workloads To Exercise

- `10k` inventory items, `10k` customers, `50k` sales
- `50k` inventory items, `50k` customers, `100k` sales
- `100k` historical sales import with chunked background jobs
- `10k` attendance rows per month per large shop
- concurrent job load:
  - dashboard rebuild
  - payroll rebuild
  - customer credit rebuild
  - import batch writes

## Local Fixture Generation

Generate sample payloads:

```bash
npm run test:load-fixture -- --inventory=50000 --customers=50000 --sales=100000
```

Outputs:

- `.artifacts/load-fixtures/inventory.json`
- `.artifacts/load-fixtures/customers.json`
- `.artifacts/load-fixtures/sales.json`

## Backend Job Expectations

Every `shops/{shopId}/jobs/{jobId}` document should include:

- `type`
- `status`
- `progress`
- `payload`
- `createdBy`
- `startedAt`
- `finishedAt`
- `retryCount`
- `errorSummary`

## Pass Criteria

- no blank screen during imports
- paged roster, attendance, and payroll stay responsive
- dashboard snapshot rebuild completes without manual intervention
- failed jobs move to `failed` with `errorSummary`
- `platform/observability/functions` heartbeat updates every `15` minutes
- Firestore rules tests pass once Java is installed and the emulator can start

## Remaining Infra Requirement

Rules validation still depends on the Firestore emulator, and the Firestore emulator still requires Java on the machine PATH.
