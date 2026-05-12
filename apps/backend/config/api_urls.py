from django.urls import include, path

from platform_apps.common.views import PlatformMetaView

urlpatterns = [
    path("", PlatformMetaView.as_view(), name="api-root"),
    path("", include("platform_apps.erpnext.urls")),
    path("migration/", include("platform_apps.jobs.urls")),
    path("migration/reconciliation/", include("platform_apps.audit.urls")),
    path("health/", include("platform_apps.health.urls")),
    path("session/", include("platform_apps.users.urls")),
    path("shops/", include("platform_apps.shops.urls")),
]
