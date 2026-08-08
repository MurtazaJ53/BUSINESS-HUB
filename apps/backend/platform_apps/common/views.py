from __future__ import annotations

from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class PlatformMetaView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {
                "service": settings.OTEL_SERVICE_NAME,
                "environment": settings.ENVIRONMENT,
                "stack": {
                    "backend": "django",
                    "api": "drf",
                    "database": "postgresql-target",
                    "queue": "celery",
                    "cache": "redis",
                },
                "phase": "phase-1-foundation",
            }
        )
