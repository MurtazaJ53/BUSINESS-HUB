"""Canonical Indian GST calculation.

Single source of truth for tax maths so the POS, the sync command handler and
receipts all agree to the paisa. Pure functions, no DB access — easy to unit
test and safe to reuse.

GST split rule:
  * Intra-state (supplier state == place of supply): CGST + SGST, each tax/2.
  * Inter-state (different states):                  IGST = full tax.
Prices may be tax-inclusive (common in Indian retail) or tax-exclusive.
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

TWO_DP = Decimal("0.01")
HUNDRED = Decimal("100")


def _money(value: Decimal) -> Decimal:
    """Round to 2 decimals (paise) using banker-safe half-up."""
    return value.quantize(TWO_DP, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class GstLine:
    """One line's GST breakdown (all amounts in major units, 2dp)."""

    taxable_amount: Decimal
    tax_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    gross_amount: Decimal


def compute_line_gst(
    line_total: Decimal,
    gst_rate: Decimal,
    *,
    price_includes_tax: bool,
    intra_state: bool,
) -> GstLine:
    """Break a line's gross/net total into GST components.

    Args:
        line_total: unit_price * quantity, as entered (gross if
            ``price_includes_tax`` else net).
        gst_rate: combined GST percentage, e.g. ``Decimal('18')``.
        price_includes_tax: whether ``line_total`` already contains tax.
        intra_state: True for CGST+SGST, False for IGST.
    """
    rate = (gst_rate or Decimal("0")) / HUNDRED

    if rate <= 0:
        taxable = _money(line_total)
        return GstLine(taxable, Decimal("0.00"), Decimal("0.00"),
                       Decimal("0.00"), Decimal("0.00"), taxable)

    if price_includes_tax:
        taxable = _money(line_total / (Decimal("1") + rate))
        tax = _money(line_total - taxable)
        gross = _money(line_total)
    else:
        taxable = _money(line_total)
        tax = _money(taxable * rate)
        gross = _money(taxable + tax)

    if intra_state:
        cgst = _money(tax / 2)
        sgst = _money(tax - cgst)  # keep the pair summing exactly to tax
        igst = Decimal("0.00")
    else:
        cgst = sgst = Decimal("0.00")
        igst = tax

    return GstLine(taxable, tax, cgst, sgst, igst, gross)


def apportion_discount(
    line_totals: list[Decimal],
    discount: Decimal,
) -> list[Decimal]:
    """Distribute a sale-level discount proportionally across lines.

    Returns a list of per-line discount amounts (same order as ``line_totals``)
    that sum exactly to ``discount``.  Rounding remainder goes to the last line.
    """
    if discount <= 0 or not line_totals:
        return [Decimal("0.00")] * len(line_totals)

    subtotal = sum(line_totals)
    if subtotal <= 0:
        return [Decimal("0.00")] * len(line_totals)

    portions: list[Decimal] = []
    allocated = Decimal("0.00")

    for i, lt in enumerate(line_totals):
        if i == len(line_totals) - 1:
            # Last item gets the remainder so the sum is exact.
            portions.append(_money(discount - allocated))
        else:
            share = _money(discount * lt / subtotal)
            portions.append(share)
            allocated += share

    return portions


def is_intra_state(supplier_state_code: str, place_of_supply_code: str) -> bool:
    """Intra-state when both GST state codes are present and equal."""
    s = (supplier_state_code or "").strip()
    p = (place_of_supply_code or "").strip()
    return bool(s) and s == p
