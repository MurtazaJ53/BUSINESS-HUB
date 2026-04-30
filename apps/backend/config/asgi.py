import os

from django.core.asgi import get_asgi_application

from config.telemetry import setup_telemetry

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

setup_telemetry()

application = get_asgi_application()
