"""Pytest bootstrap: run the suite without external infra.

Set the in-memory channel layer before Django settings load so realtime
broadcasts don't require a running Redis server during tests.
"""
import os

os.environ.setdefault("USE_INMEMORY_CHANNELS", "1")

import pytest


@pytest.fixture(autouse=True)
def _reset_throttle_cache():
    """Clear the cache before every test so DRF rate-throttle counters (which
    live in the default cache) never bleed across tests and cause spurious 429s.
    Covers all suites uniformly without each TestCase resetting it by hand."""
    from django.core.cache import cache

    cache.clear()
    yield
