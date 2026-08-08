"""Subscription pricing for Business Hub.

One paid plan (Pro) sold over four billing durations. There is no permanent
free plan: a new workspace gets a 30-day full-Pro trial, after which it must be
paid for. An unpaid workspace falls back to the limited `starter` state, which
keeps the shop's data readable and basic billing working while the paid
features lock.

Amounts are whole rupees. Money is stored in paise on the invoice so nothing
depends on float arithmetic.
"""
from __future__ import annotations

from decimal import Decimal

# The tier a paying / trialing workspace runs on.
PAID_PLAN_TIER = "pro"
# The tier an unpaid workspace falls back to.
UNPAID_PLAN_TIER = "starter"

TRIAL_DAYS = 30


class BillingPeriod:
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    HALF_YEARLY = "half_yearly"
    YEARLY = "yearly"

    CHOICES = (
        (MONTHLY, "Monthly"),
        (QUARTERLY, "Quarterly"),
        (HALF_YEARLY, "Half-yearly"),
        (YEARLY, "Yearly"),
    )


# period -> (rupees, days, label)
PLAN_PRICING: dict[str, dict] = {
    BillingPeriod.MONTHLY: {
        "amount": Decimal("500.00"),
        "days": 30,
        "label": "Monthly",
        "months": 1,
    },
    BillingPeriod.QUARTERLY: {
        "amount": Decimal("1450.00"),
        "days": 90,
        "label": "Quarterly",
        "months": 3,
    },
    BillingPeriod.HALF_YEARLY: {
        "amount": Decimal("2850.00"),
        "days": 182,
        "label": "Half-yearly",
        "months": 6,
    },
    BillingPeriod.YEARLY: {
        "amount": Decimal("5500.00"),
        "days": 365,
        "label": "Yearly",
        "months": 12,
    },
}


def is_valid_period(period: str) -> bool:
    return period in PLAN_PRICING


def price_for(period: str) -> Decimal:
    if not is_valid_period(period):
        raise ValueError(f"Unknown billing period: {period}")
    return PLAN_PRICING[period]["amount"]


def days_for(period: str) -> int:
    if not is_valid_period(period):
        raise ValueError(f"Unknown billing period: {period}")
    return PLAN_PRICING[period]["days"]


def effective_monthly_rupees(period: str) -> Decimal:
    """What the plan works out to per month — used to show the saving."""
    info = PLAN_PRICING[period]
    return (info["amount"] / Decimal(info["months"])).quantize(Decimal("0.01"))


def savings_percent(period: str) -> int:
    """How much cheaper per month than paying monthly (0 for monthly)."""
    if period == BillingPeriod.MONTHLY:
        return 0
    monthly = PLAN_PRICING[BillingPeriod.MONTHLY]["amount"]
    effective = effective_monthly_rupees(period)
    return int(((monthly - effective) / monthly * 100).to_integral_value())


def public_catalog() -> list[dict]:
    """Plan options for the app's plan screen."""
    catalog = []
    for period, _label in BillingPeriod.CHOICES:
        info = PLAN_PRICING[period]
        catalog.append(
            {
                "period": period,
                "label": info["label"],
                "amount": info["amount"],
                "days": info["days"],
                "effective_monthly": effective_monthly_rupees(period),
                "savings_percent": savings_percent(period),
            }
        )
    return catalog
