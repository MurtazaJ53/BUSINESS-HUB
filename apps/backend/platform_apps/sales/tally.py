"""Tally-compatible XML export of sales vouchers.

Indian accountants overwhelmingly work in Tally, and "can my CA import this?"
decides whether a shop can use the app at all. Tally imports an <ENVELOPE> of
vouchers, so we emit that rather than a CSV the CA has to retype.

Accounting conventions that matter here:
  * Tally treats a *debit* as a negative AMOUNT with ISDEEMEDPOSITIVE=Yes, and
    a *credit* as positive with ISDEEMEDPOSITIVE=No. Getting this backwards
    silently reverses every entry.
  * Each voucher must balance: the party/cash debit equals sales + tax credits.
  * Dates are YYYYMMDD with no separators.
"""
from __future__ import annotations

from decimal import Decimal
from xml.sax.saxutils import escape

# Ledger names a CA will recognise. If their chart of accounts differs they can
# rename on import, but these are the Tally defaults.
LEDGER_SALES = "Sales Account"
LEDGER_CGST = "Output CGST"
LEDGER_SGST = "Output SGST"
LEDGER_IGST = "Output IGST"
LEDGER_CASH = "Cash"


def _money(value: Decimal | None) -> str:
    return f"{Decimal(value or 0):.2f}"


def _entry(ledger: str, amount: Decimal, *, debit: bool) -> str:
    """One ledger line. Debits are negative in Tally's XML."""
    signed = -Decimal(amount) if debit else Decimal(amount)
    return (
        "<ALLLEDGERENTRIES.LIST>"
        f"<LEDGERNAME>{escape(ledger)}</LEDGERNAME>"
        f"<ISDEEMEDPOSITIVE>{'Yes' if debit else 'No'}</ISDEEMEDPOSITIVE>"
        f"<AMOUNT>{_money(signed)}</AMOUNT>"
        "</ALLLEDGERENTRIES.LIST>"
    )


def _voucher(sale) -> str:
    total = Decimal(sale.total_amount or 0)
    cgst = Decimal(sale.cgst_amount or 0)
    sgst = Decimal(sale.sgst_amount or 0)
    igst = Decimal(sale.igst_amount or 0)
    # Whatever isn't tax is revenue. Derived rather than read from
    # taxable_amount so the voucher always balances even if a legacy row has
    # inconsistent tax columns.
    revenue = total - cgst - sgst - igst

    party = (sale.customer_name_snapshot or "").strip() or LEDGER_CASH
    date = sale.sale_date.strftime("%Y%m%d") if sale.sale_date else ""
    number = escape((sale.receipt_number or str(sale.id))[:64])

    parts = [
        f'<VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">',
        f"<DATE>{date}</DATE>",
        f"<EFFECTIVEDATE>{date}</EFFECTIVEDATE>",
        "<VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>",
        f"<VOUCHERNUMBER>{number}</VOUCHERNUMBER>",
        f"<PARTYLEDGERNAME>{escape(party)}</PARTYLEDGERNAME>",
        "<PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>",
        # Debit what the shop received (cash/bank/party).
        _entry(party, total, debit=True),
        # Credit revenue and each tax head.
        _entry(LEDGER_SALES, revenue, debit=False),
    ]
    if cgst:
        parts.append(_entry(LEDGER_CGST, cgst, debit=False))
    if sgst:
        parts.append(_entry(LEDGER_SGST, sgst, debit=False))
    if igst:
        parts.append(_entry(LEDGER_IGST, igst, debit=False))
    parts.append("</VOUCHER>")
    return "".join(parts)


def build_tally_xml(shop, sales) -> str:
    """Wrap sales vouchers in the envelope Tally's Import Data expects."""
    company = escape((shop.name or "Company").strip())
    messages = "".join(
        f"<TALLYMESSAGE xmlns:UDF=\"TallyUDF\">{_voucher(sale)}</TALLYMESSAGE>"
        for sale in sales
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<ENVELOPE>"
        "<HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>"
        "<BODY><IMPORTDATA>"
        "<REQUESTDESC>"
        "<REPORTNAME>Vouchers</REPORTNAME>"
        "<STATICVARIABLES>"
        f"<SVCURRENTCOMPANY>{company}</SVCURRENTCOMPANY>"
        "</STATICVARIABLES>"
        "</REQUESTDESC>"
        f"<REQUESTDATA>{messages}</REQUESTDATA>"
        "</IMPORTDATA></BODY>"
        "</ENVELOPE>"
    )
