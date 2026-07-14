"""Pytest bootstrap: run the suite without external infra.

Set the in-memory channel layer before Django settings load so realtime
broadcasts don't require a running Redis server during tests.
"""
import os

os.environ.setdefault("USE_INMEMORY_CHANNELS", "1")
