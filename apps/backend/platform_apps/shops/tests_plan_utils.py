"""Pure unit tests for shop plan utilities (no DB required).

``normalize_plan_tier`` and ``build_enabled_features`` are pure functions.
"""
from __future__ import annotations

import pytest

from platform_apps.shops.plans import (
    DEFAULT_PLAN_TIER,
    PLAN_TIERS,
    build_enabled_features,
    normalize_plan_tier,
)


# ---------------------------------------------------------------------------
# normalize_plan_tier
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("tier", PLAN_TIERS)
def test_valid_tier_passes_through(tier):
    assert normalize_plan_tier(tier) == tier


@pytest.mark.parametrize("bad", ["", None, "enterprise", "FREE", "basic", 0, {}, []])
def test_unknown_tier_returns_default(bad):
    assert normalize_plan_tier(bad) == DEFAULT_PLAN_TIER


def test_case_insensitive():
    assert normalize_plan_tier("STARTER") == "starter"
    assert normalize_plan_tier("Growth") == "growth"
    assert normalize_plan_tier("PRO") == "pro"


def test_whitespace_stripped():
    assert normalize_plan_tier("  pro  ") == "pro"


# ---------------------------------------------------------------------------
# build_enabled_features — starter
# ---------------------------------------------------------------------------

def test_starter_has_no_premium_features():
    features = build_enabled_features("starter")
    assert features["expenses"] is False
    assert features["attendance"] is False
    assert features["supplier_directory"] is False
    assert features["purchase_workflow"] is False
    assert features["advanced_reports"] is False
    assert features["multi_branch"] is False
    assert features["finance_summary"] is False
    assert features["advanced_ops"] is False


# ---------------------------------------------------------------------------
# build_enabled_features — growth
# ---------------------------------------------------------------------------

def test_growth_has_operational_features():
    features = build_enabled_features("growth")
    assert features["expenses"] is True
    assert features["attendance"] is True
    assert features["supplier_directory"] is True


def test_growth_lacks_pro_only_features():
    features = build_enabled_features("growth")
    assert features["purchase_workflow"] is False
    assert features["advanced_reports"] is False
    assert features["multi_branch"] is False


# ---------------------------------------------------------------------------
# build_enabled_features — pro
# ---------------------------------------------------------------------------

def test_pro_has_all_features():
    features = build_enabled_features("pro")
    for key in features:
        assert features[key] is True, f"Expected {key} to be enabled on pro"


# ---------------------------------------------------------------------------
# build_enabled_features — overrides
# ---------------------------------------------------------------------------

def test_override_can_disable_a_feature_on_pro():
    features = build_enabled_features("pro", overrides={"expenses": False})
    assert features["expenses"] is False
    # Other features unaffected
    assert features["attendance"] is True


def test_override_can_enable_a_feature_on_starter():
    features = build_enabled_features("starter", overrides={"expenses": True})
    assert features["expenses"] is True


def test_override_with_none_treats_as_default():
    """normalize_plan_tier('unknown') returns DEFAULT_PLAN_TIER, not crash."""
    features = build_enabled_features(None)  # type: ignore[arg-type]
    assert isinstance(features, dict)
    # None -> DEFAULT_PLAN_TIER ('growth') -> growth features
    assert features["expenses"] is True  # growth has expenses


def test_all_returned_keys_are_known():
    """No surprise keys added without updating FEATURE_LABELS."""
    from platform_apps.shops.permissions import FEATURE_LABELS
    features = build_enabled_features("pro")
    for key in features:
        assert key in FEATURE_LABELS, f"Unexpected feature key: {key}"
