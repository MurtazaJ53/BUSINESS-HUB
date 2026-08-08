from __future__ import annotations

from typing import Any

DEFAULT_PLAN_TIER = "growth"
PLAN_TIERS = ("starter", "growth", "pro")


def normalize_plan_tier(value: Any) -> str:
    candidate = str(value or "").strip().lower()
    if candidate in PLAN_TIERS:
        return candidate
    return DEFAULT_PLAN_TIER


def build_enabled_features(
    plan_tier: str,
    overrides: dict[str, Any] | None = None,
) -> dict[str, bool]:
    normalized_tier = normalize_plan_tier(plan_tier)
    features: dict[str, bool] = {
        "expenses": normalized_tier in {"growth", "pro"},
        "attendance": normalized_tier in {"growth", "pro"},
        "supplier_directory": normalized_tier in {"growth", "pro"},
        "purchase_workflow": normalized_tier == "pro",
        "advanced_reports": normalized_tier == "pro",
        "multi_branch": normalized_tier == "pro",
        "finance_summary": normalized_tier == "pro",
        "advanced_ops": normalized_tier == "pro",
    }

    if overrides:
        for key, value in overrides.items():
            features[str(key)] = bool(value)

    return features
