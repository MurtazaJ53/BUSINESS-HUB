from __future__ import annotations

import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_INITIALIZED = False


def _build_traces_endpoint() -> str | None:
    direct = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
    if direct:
        return direct

    base = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not base:
        return None

    return f"{base.rstrip('/')}/v1/traces"


def setup_telemetry() -> None:
    global _INITIALIZED

    if _INITIALIZED:
        return

    if os.getenv("OTEL_ENABLED", "false").lower() not in {"1", "true", "yes", "on"}:
        return

    endpoint = _build_traces_endpoint()
    if not endpoint:
        return

    resource = Resource.create(
        {
            "service.name": os.getenv("OTEL_SERVICE_NAME", "business-hub-backend"),
            "deployment.environment": os.getenv("DJANGO_ENV", "development"),
        }
    )
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(endpoint=endpoint)))
    trace.set_tracer_provider(provider)

    DjangoInstrumentor().instrument()
    PsycopgInstrumentor().instrument()
    _INITIALIZED = True
