"""Loyalty point rules.

Deliberately simple, because the cashier has to be able to explain it across
the counter in one sentence: "you get N points per Rs.100, and 1 point is worth
Rs.1 off". Anything with tiers or decay would be argued with daily.

Configuration lives in the shop's settings_json under "loyalty":

    {"enabled": true, "points_per_hundred": 1, "point_value": 1}
"""
from __future__ import annotations

from decimal import ROUND_DOWN, Decimal

DEFAULT_POINTS_PER_HUNDRED = 1
DEFAULT_POINT_VALUE = Decimal("1.00")


def loyalty_config(shop) -> dict:
    raw = (shop.settings_json or {}).get("loyalty")
    config = raw if isinstance(raw, dict) else {}

    try:
        per_hundred = int(config.get("points_per_hundred", DEFAULT_POINTS_PER_HUNDRED))
    except (TypeError, ValueError):
        per_hundred = DEFAULT_POINTS_PER_HUNDRED
    try:
        point_value = Decimal(str(config.get("point_value", DEFAULT_POINT_VALUE)))
    except (TypeError, ValueError, ArithmeticError):
        point_value = DEFAULT_POINT_VALUE

    return {
        "enabled": bool(config.get("enabled", False)),
        # Guard against a misconfiguration handing out unlimited points.
        "points_per_hundred": max(0, min(per_hundred, 1000)),
        "point_value": point_value if point_value > 0 else DEFAULT_POINT_VALUE,
    }


def points_for_sale(shop, amount: Decimal) -> int:
    """Points earned on a bill. Rounds DOWN — a shop should never owe more
    than it intended, and part-points are what customers dispute."""
    config = loyalty_config(shop)
    if not config["enabled"] or config["points_per_hundred"] <= 0:
        return 0
    value = Decimal(amount or 0)
    if value <= 0:
        return 0
    hundreds = (value / Decimal("100")).to_integral_value(rounding=ROUND_DOWN)
    return int(hundreds) * config["points_per_hundred"]


def redemption_value(shop, points: int) -> Decimal:
    """What `points` are worth in rupees."""
    config = loyalty_config(shop)
    if not config["enabled"] or points <= 0:
        return Decimal("0.00")
    return (Decimal(points) * config["point_value"]).quantize(Decimal("0.01"))


def clamp_redemption(shop, *, requested: int, available: int, bill_total: Decimal) -> int:
    """How many points may actually be spent on this bill.

    Capped by what the customer holds and by the bill itself, so redeeming can
    never produce a negative total or hand back cash.
    """
    config = loyalty_config(shop)
    if not config["enabled"]:
        return 0
    points = max(0, min(int(requested or 0), int(available or 0)))
    if points <= 0:
        return 0

    total = Decimal(bill_total or 0)
    if total <= 0:
        return 0
    affordable = int(
        (total / config["point_value"]).to_integral_value(rounding=ROUND_DOWN)
    )
    return max(0, min(points, affordable))
