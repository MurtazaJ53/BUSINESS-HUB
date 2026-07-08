"""Shared query helpers for shop-scoped list endpoints."""

from __future__ import annotations

DEFAULT_LIST_LIMIT = 200
MAX_LIST_LIMIT = 500


def bounded_list_limit(
    raw: object,
    *,
    default: int = DEFAULT_LIST_LIMIT,
    maximum: int = MAX_LIST_LIMIT,
) -> int:
    """Clamp a client-supplied ``?limit=`` to a safe range.

    These list endpoints intentionally return a bare JSON array (not a
    paginated envelope) because the mobile client expects a list. To keep
    that contract safe at very large row counts, the queryset is sliced to
    this bound so a single request never serializes an unbounded result set.
    """
    try:
        value = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    if value <= 0:
        return default
    return min(value, maximum)
