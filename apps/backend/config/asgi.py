import os

from django.core.asgi import get_asgi_application

from config.telemetry import setup_telemetry

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

setup_telemetry()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import platform_apps.common.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            platform_apps.common.routing.websocket_urlpatterns
        )
    ),
})
