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
