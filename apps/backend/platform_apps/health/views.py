from __future__ import annotations

from django.conf import settings
from django.core.cache import cache
from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class SystemHealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "service": settings.OTEL_SERVICE_NAME,
                "environment": settings.ENVIRONMENT,
            }
        )


class ReadinessView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        database_ready = True
        cache_ready = True
        database_error = None
        cache_error = None

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:  # pragma: no cover
            database_ready = False
            database_error = str(exc)

        try:
            cache.get("business-hub-healthcheck")
        except Exception as exc:  # pragma: no cover
            cache_ready = False
            cache_error = str(exc)

        payload = {
            "status": "ok" if database_ready and cache_ready else "degraded",
            "checks": {
                "database": {"ready": database_ready, "vendor": connection.vendor, "error": database_error},
                "cache": {"ready": cache_ready, "location": settings.CACHES["default"]["LOCATION"], "error": cache_error},
            },
        }
        return Response(payload, status=200 if database_ready and cache_ready else 503)
