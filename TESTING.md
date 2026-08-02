# Business Hub Testing Architecture & Standards

This document describes the automated test architecture, conventions, and execution procedures across the Business Hub monorepo.

---

## 1. Monorepo Architecture & Invariants

The monorepo consists of:
- **`apps/backend/`**: Django 6 + Django REST Framework + Channels + PostgreSQL multi-tenant SaaS backend.
- **`apps/mobile_flutter/`**: Flutter cross-platform POS & business management app.
- **`apps/admin_web/`**: Next.js Platform & Shop Administration Web Console.

### Core Security & Invariants
1. **Tenant Authorization Choke Point**:
   - Every shop-scoped endpoint MUST authenticate through `get_membership_or_403(user, shop_id, minimum_role)` in `platform_apps/shops/permissions.py`.
   - Any request missing membership in the requested tenant receives an immediate HTTP 403 Forbidden.
   - Suspended shops block all access, including the shop owner.
2. **PII Protection & Blind Index**:
   - Customer phone numbers and sensitive data are encrypted at rest using AES cryptography (`django_cryptography`).
   - Exact-match searchability is preserved through HMAC-SHA256 blind indexing (`phone_hash`) with country-code normalization.
3. **Password Security**:
   - All passwords are encrypted with Argon2 (`argon2-cffi`), never MD5/SHA1 or plaintext.
4. **Rate Limiting**:
   - Auth endpoints (`/api/v1/session/token/`, `/api/v1/register/`) are throttled against brute-force attacks.

---

## 2. Backend Automated Test Suite (`apps/backend/`)

### Running Tests
To run all tests:
```bash
cd apps/backend
.venv/Scripts/python.exe -m pytest -q
```

To run targeted test modules:
```bash
# Tenant isolation & permissions
.venv/Scripts/python.exe -m pytest platform_apps/shops/tests_tenant_security.py -v

# PII & blind index encryption
.venv/Scripts/python.exe -m pytest platform_apps/customers/tests_pii.py -v

# Security (IDOR, role escalation, rate limits, hashing)
.venv/Scripts/python.exe -m pytest platform_apps/shops/tests_security.py -v

# Platform admin governance & lifecycle
.venv/Scripts/python.exe -m pytest platform_apps/platform_admin/tests.py -v

# Performance & N+1 query regression
.venv/Scripts/python.exe -m pytest platform_apps/shops/tests_performance.py -v

# Pure domain tests (GST, Plans, Blind Index)
.venv/Scripts/python.exe -m pytest platform_apps/common/tests_domain.py -v
```

### Test Suite Structure
| Test Suite | Purpose |
| :--- | :--- |
| `platform_apps/common/tests_domain.py` | Unit tests for pure business logic (GST calculation, blind indexing, plan definitions). |
| `platform_apps/shops/tests_tenant_security.py` | Multi-tenant cross-shop isolation, shop suspension gates, minimum role enforcement. |
| `platform_apps/customers/tests_pii.py` | Customer PII encryption verification, blind index normalization, and lookup. |
| `platform_apps/shops/tests_security.py` | IDOR protection, role self-promotion blocking, Argon2 hash checks, auth rate-limiting. |
| `platform_apps/platform_admin/tests.py` | Platform admin endpoints, shop lifecycle (suspend, activate, approve, plan change), audit trail. |
| `platform_apps/shops/tests_performance.py` | Query count assertions (`CaptureQueriesContext`) to guarantee O(1) query complexity on summary aggregations. |

---

## 3. Flutter Automated Test Suite (`apps/mobile_flutter/`)

### Running Tests
To run Flutter unit and component tests:
```bash
cd apps/mobile_flutter
flutter test test/cart_pricing_test.dart test/gst_test.dart test/money_test.dart test/outbox_backoff_test.dart test/profit_and_loss_test.dart test/upi_qr_test.dart test/core/
```

### Test Suite Structure
| Test Suite | Purpose |
| :--- | :--- |
| `test/core/checkout/checkout_invariants_test.dart` | Pure property & financial conservation invariants for cashier tender resolution. |
| `test/core/checkout/checkout_policy_test.dart` | Tender capping, cash change calculation, split payments, credit validation. |
| `test/core/tax/gst_test.dart` | Intra-state CGST/SGST splitting, inter-state IGST handling, rounding rules. |
| `test/core/runtime/` | Offline outbox queue, backoff algorithms, operator readiness reports. |

---

## 4. Continuous Integration (CI/CD)

The GitHub Actions workflow located at `.github/workflows/ci.yml` runs on every push and pull request:
1. **Flutter Job**: Runs `flutter analyze` and `flutter test`.
2. **Backend Job**: Runs `python manage.py check` and `python -m pytest -q` against Python 3.13.
