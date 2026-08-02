"""Pure unit tests for the blind-index helper (no DB required).

``generate_blind_index`` is a keyed HMAC-SHA256 over the last 10 digits of a
phone number.  These tests exercise normalization, edge inputs, and hash
stability using ``override_settings`` to inject a known pepper.
"""
from __future__ import annotations

import pytest
from django.test import override_settings

from platform_apps.common.blind_index import generate_blind_index

# Use a fixed pepper for every test so expectations are stable.
_PEPPER = "test-pepper-for-unit-tests"


@pytest.fixture(autouse=True)
def set_pepper(settings):
    """Inject a deterministic pepper for every test in this module."""
    settings.BLIND_INDEX_PEPPER = _PEPPER


# ---------------------------------------------------------------------------
# Basic passthrough
# ---------------------------------------------------------------------------

def test_standard_10_digit_number_returns_hex():
    result = generate_blind_index("9876543210")
    assert isinstance(result, str)
    assert len(result) == 64  # SHA256 hex


def test_same_number_hashed_twice_gives_same_result():
    a = generate_blind_index("9876543210")
    b = generate_blind_index("9876543210")
    assert a == b


def test_different_numbers_give_different_hashes():
    a = generate_blind_index("9876543210")
    b = generate_blind_index("9876543211")
    assert a != b


# ---------------------------------------------------------------------------
# Normalization — all these strings should hash to the same value
# ---------------------------------------------------------------------------

def test_plus91_prefix_normalized():
    with_prefix = generate_blind_index("+919876543210")
    without = generate_blind_index("9876543210")
    assert with_prefix == without


def test_leading_zero_trunk_prefix_normalized():
    """'09876543210' (11 digits) strips to last 10."""
    trunk = generate_blind_index("09876543210")
    plain = generate_blind_index("9876543210")
    assert trunk == plain


def test_spaces_and_dashes_stripped():
    formatted = generate_blind_index("+91 98765-43210")
    plain = generate_blind_index("9876543210")
    assert formatted == plain


def test_isd_code_retained_last_10():
    """A foreign number longer than 10 digits is kept as last-10 digits."""
    # +12125551234 -> last 10 = 2125551234
    result = generate_blind_index("+12125551234")
    expected = generate_blind_index("2125551234")
    assert result == expected


# ---------------------------------------------------------------------------
# Edge / degenerate inputs
# ---------------------------------------------------------------------------

def test_none_returns_empty_string():
    assert generate_blind_index(None) == ""  # type: ignore[arg-type]


def test_empty_string_returns_empty_string():
    assert generate_blind_index("") == ""


def test_non_digit_only_string_returns_empty():
    """A string with no digits at all (e.g. a name accidentally passed in)."""
    assert generate_blind_index("abcdef") == ""


def test_single_dash_sentinel_returns_empty():
    """The Customer model stores '-' when no phone is set."""
    assert generate_blind_index("-") == ""


def test_whitespace_only_returns_empty():
    assert generate_blind_index("   ") == ""


# ---------------------------------------------------------------------------
# Pepper change produces a different hash (rainbow-table protection)
# ---------------------------------------------------------------------------

def test_different_pepper_produces_different_hash():
    with override_settings(BLIND_INDEX_PEPPER="first-pepper"):
        h1 = generate_blind_index("9876543210")
    with override_settings(BLIND_INDEX_PEPPER="second-pepper"):
        h2 = generate_blind_index("9876543210")
    assert h1 != h2
