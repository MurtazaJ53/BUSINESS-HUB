"""Unit tests for the canonical GST calculator (no DB required)."""
from decimal import Decimal

from platform_apps.sales.gst import compute_line_gst, is_intra_state


def test_tax_inclusive_intra_state_splits_cgst_sgst():
    line = compute_line_gst(
        Decimal("118.00"), Decimal("18"),
        price_includes_tax=True, intra_state=True,
    )
    assert line.taxable_amount == Decimal("100.00")
    assert line.tax_amount == Decimal("18.00")
    assert line.cgst_amount == Decimal("9.00")
    assert line.sgst_amount == Decimal("9.00")
    assert line.igst_amount == Decimal("0.00")
    assert line.gross_amount == Decimal("118.00")


def test_tax_exclusive_inter_state_uses_igst():
    line = compute_line_gst(
        Decimal("100.00"), Decimal("18"),
        price_includes_tax=False, intra_state=False,
    )
    assert line.taxable_amount == Decimal("100.00")
    assert line.tax_amount == Decimal("18.00")
    assert line.igst_amount == Decimal("18.00")
    assert line.cgst_amount == Decimal("0.00")
    assert line.sgst_amount == Decimal("0.00")
    assert line.gross_amount == Decimal("118.00")


def test_cgst_plus_sgst_always_equals_tax_on_odd_paise():
    # 5% on 105 inclusive -> tax 5.00; odd splits must still sum exactly.
    line = compute_line_gst(
        Decimal("105.00"), Decimal("5"),
        price_includes_tax=True, intra_state=True,
    )
    assert line.cgst_amount + line.sgst_amount == line.tax_amount


def test_zero_rate_is_passthrough():
    line = compute_line_gst(
        Decimal("50.00"), Decimal("0"),
        price_includes_tax=True, intra_state=True,
    )
    assert line.taxable_amount == Decimal("50.00")
    assert line.tax_amount == Decimal("0.00")
    assert line.gross_amount == Decimal("50.00")


def test_is_intra_state():
    assert is_intra_state("27", "27") is True
    assert is_intra_state("27", "29") is False
    assert is_intra_state("", "27") is False


def test_apportion_discount():
    from platform_apps.sales.gst import apportion_discount

    # Simple proportional split
    assert apportion_discount([Decimal("100"), Decimal("100")], Decimal("20")) == [Decimal("10.00"), Decimal("10.00")]

    # Rounding remainder goes to the last line (sum must be exactly 10)
    # 100/300 * 10 = 3.33, 200/300 * 10 = 6.67
    assert apportion_discount([Decimal("100"), Decimal("200")], Decimal("10")) == [Decimal("3.33"), Decimal("6.67")]

    # Tricky rounding: 3 lines, total=100. discount=10.
    # 33.33, 33.33, 33.34
    assert apportion_discount([Decimal("100"), Decimal("100"), Decimal("100")], Decimal("10")) == [Decimal("3.33"), Decimal("3.33"), Decimal("3.34")]

    # Zero line totals
    assert apportion_discount([Decimal("0"), Decimal("0")], Decimal("10")) == [Decimal("0.00"), Decimal("0.00")]

    # Zero discount
    assert apportion_discount([Decimal("100")], Decimal("0")) == [Decimal("0.00")]


def test_apportion_discount_single_item():
    """A single-item cart absorbs the full discount."""
    from platform_apps.sales.gst import apportion_discount

    result = apportion_discount([Decimal("500")], Decimal("50"))
    assert result == [Decimal("50.00")]


def test_apportion_discount_empty_list():
    """Empty line-total list returns an empty list."""
    from platform_apps.sales.gst import apportion_discount

    assert apportion_discount([], Decimal("100")) == []


def test_apportion_discount_larger_than_subtotal():
    """Discount > subtotal: last line gets remainder (can go negative in theory
    but the logic stays correct — caller is responsible for validation)."""
    from platform_apps.sales.gst import apportion_discount

    # 100+100 = 200, discount = 300 -> each proportional share = 150
    result = apportion_discount([Decimal("100"), Decimal("100")], Decimal("300"))
    # Each line gets 150.00, last line absorbs remainder
    assert sum(result) == Decimal("300.00")


# ---------------------------------------------------------------------------
# Additional rate coverage
# ---------------------------------------------------------------------------

def test_5pct_inclusive_intra():
    """5% inclusive split into CGST 2.5 + SGST 2.5 with odd-paise guard."""
    line = compute_line_gst(
        Decimal("105.00"), Decimal("5"),
        price_includes_tax=True, intra_state=True,
    )
    assert line.taxable_amount == Decimal("100.00")
    assert line.tax_amount == Decimal("5.00")
    assert line.cgst_amount + line.sgst_amount == line.tax_amount
    assert line.gross_amount == Decimal("105.00")


def test_12pct_exclusive_inter():
    """12% exclusive inter-state → IGST only."""
    line = compute_line_gst(
        Decimal("100.00"), Decimal("12"),
        price_includes_tax=False, intra_state=False,
    )
    assert line.taxable_amount == Decimal("100.00")
    assert line.tax_amount == Decimal("12.00")
    assert line.igst_amount == Decimal("12.00")
    assert line.cgst_amount == Decimal("0.00")
    assert line.sgst_amount == Decimal("0.00")
    assert line.gross_amount == Decimal("112.00")


def test_28pct_inclusive_intra():
    """28% inclusive intra-state."""
    line = compute_line_gst(
        Decimal("128.00"), Decimal("28"),
        price_includes_tax=True, intra_state=True,
    )
    assert line.gross_amount == Decimal("128.00")
    assert line.cgst_amount + line.sgst_amount == line.tax_amount
    assert line.igst_amount == Decimal("0.00")


def test_fractional_rate_25pct():
    """2.5% is a valid GST rate in certain categories."""
    line = compute_line_gst(
        Decimal("100.00"), Decimal("2.5"),
        price_includes_tax=False, intra_state=False,
    )
    assert line.tax_amount == Decimal("2.50")
    assert line.igst_amount == Decimal("2.50")


# ---------------------------------------------------------------------------
# is_intra_state edge cases
# ---------------------------------------------------------------------------

def test_is_intra_state_whitespace_stripped():
    """Leading/trailing whitespace must not cause a false negative."""
    assert is_intra_state(" 27 ", " 27 ") is True


def test_is_intra_state_empty_place():
    """If place_of_supply is empty, treat as inter-state."""
    assert is_intra_state("27", "") is False


def test_is_intra_state_none_values():
    """None inputs should not raise — they default to inter-state."""
    assert is_intra_state(None, None) is False  # type: ignore[arg-type]
    assert is_intra_state("27", None) is False   # type: ignore[arg-type]
