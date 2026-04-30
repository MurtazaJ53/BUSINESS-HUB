from django.urls import include, path

from platform_apps.common.views import PlatformMetaView

urlpatterns = [
    path("", PlatformMetaView.as_view(), name="api-root"),
    path("health/", include("platform_apps.health.urls")),
]
