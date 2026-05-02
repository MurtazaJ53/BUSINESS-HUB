from __future__ import annotations

from django.db import models


class MigrationDomain(models.TextChoices):
    SHOP_SETTINGS = "shop_settings", "Shop settings"
    INVENTORY = "inventory", "Inventory"
    INVENTORY_PRIVATE = "inventory_private", "Inventory private"
    CUSTOMERS = "customers", "Customers"
    CUSTOMER_LEDGER = "customer_ledger", "Customer ledger"
    EXPENSES = "expenses", "Expenses"
    ATTENDANCE = "attendance", "Attendance"
    SALES = "sales", "Sales"
    PAYMENTS = "payments", "Payments"
    STOCK_LEDGER = "stock_ledger", "Stock ledger"
    REPORTING = "reporting", "Reporting"


class MigrationWriteMaster(models.TextChoices):
    FIREBASE = "firebase", "Firebase"
    POSTGRES = "postgres", "PostgreSQL"


class MigrationBridgeMode(models.TextChoices):
    DISABLED = "disabled", "Disabled"
    COMPARE_ONLY = "compare_only", "Compare only"
    FIREBASE_TO_POSTGRES = "firebase_to_postgres", "Firebase to PostgreSQL"
    POSTGRES_TO_FIREBASE = "postgres_to_firebase", "PostgreSQL to Firebase"


class MigrationCutoverStatus(models.TextChoices):
    LEGACY = "legacy", "Legacy"
    PILOT = "pilot", "Pilot"
    READY = "ready", "Ready"
    POSTGRES_PRIMARY = "postgres_primary", "PostgreSQL primary"


class MigrationJobType(models.TextChoices):
    BACKFILL = "backfill", "Backfill"
    SHADOW_COMPARE = "shadow_compare", "Shadow compare"
    BRIDGE_REPLAY = "bridge_replay", "Bridge replay"
    PROJECTION_REFRESH = "projection_refresh", "Projection refresh"


class MigrationJobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


class MigrationControlEventType(models.TextChoices):
    PREPARE_PILOT = "prepare_pilot", "Prepare pilot"
    PROMOTE_READY = "promote_ready", "Promote ready"
    PROMOTE_PRIMARY = "promote_primary", "Promote primary"
    VERIFY_PILOT = "verify_pilot", "Verify pilot"
    ROLLBACK = "rollback", "Rollback"


class MigrationShopCheckpointDecision(models.TextChoices):
    APPROVED_FOR_CUTOVER = "approved_for_cutover", "Approved for cutover"
    HOLD_FOR_MONITORING = "hold_for_monitoring", "Hold for monitoring"
    ROLLBACK_ESCALATED = "rollback_escalated", "Rollback escalated"


class MigrationPhaseCheckpointDecision(models.TextChoices):
    APPROVED_FOR_NEXT_PHASE = "approved_for_next_phase", "Approved for next phase"
    HOLD_FOR_MONITORING = "hold_for_monitoring", "Hold for monitoring"
    ROLLBACK_ESCALATED = "rollback_escalated", "Rollback escalated"


class MigrationLaunchCheckpointDecision(models.TextChoices):
    APPROVED_FOR_LAUNCH = "approved_for_launch", "Approved for launch"
    HOLD_FOR_HARDENING = "hold_for_hardening", "Hold for hardening"
    ROLLBACK_TO_PHASE4 = "rollback_to_phase4", "Rollback to phase 4"


class MigrationGoLiveCheckpointDecision(models.TextChoices):
    EXECUTE_GO_LIVE = "execute_go_live", "Execute go-live"
    REMAIN_IN_HYPERCARE = "remain_in_hypercare", "Remain in hypercare"
    HANDOFF_TO_STEADY_STATE = "handoff_to_steady_state", "Handoff to steady state"
    ROLLBACK_LAUNCH = "rollback_launch", "Rollback launch"


class MigrationRolloutCheckpointDecision(models.TextChoices):
    ADVANCE_ROLLOUT_WAVE = "advance_rollout_wave", "Advance rollout wave"
    HOLD_ROLLOUT_WAVE = "hold_rollout_wave", "Hold rollout wave"
    SCALE_TUNING_ACTIVE = "scale_tuning_active", "Scale tuning active"
    COMPLETE_ROLLOUT = "complete_rollout", "Complete rollout"
    ROLLBACK_SHOP_WAVE = "rollback_shop_wave", "Rollback shop wave"


class ReconciliationSeverity(models.TextChoices):
    INFO = "info", "Info"
    WARNING = "warning", "Warning"
    CRITICAL = "critical", "Critical"


class ReconciliationStatus(models.TextChoices):
    OPEN = "open", "Open"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    RESOLVED = "resolved", "Resolved"
    IGNORED = "ignored", "Ignored"
