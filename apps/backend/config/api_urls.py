from django.urls import include, path

from platform_apps.common.views import PlatformMetaView
from platform_apps.shops.invite_views import InviteAcceptView, InvitePreviewView
from platform_apps.users.registration_views import RegisterView

urlpatterns = [
    path("", PlatformMetaView.as_view(), name="api-root"),
    path("register/", RegisterView.as_view(), name="register"),
    path("invites/accept/", InviteAcceptView.as_view(), name="invite-accept"),
    path("invites/<str:token>/", InvitePreviewView.as_view(), name="invite-preview"),
    path("", include("platform_apps.erpnext.urls")),
    path("migration/", include("platform_apps.jobs.urls")),
    path("migration/reconciliation/", include("platform_apps.audit.urls")),
    path("health/", include("platform_apps.health.urls")),
    path("session/", include("platform_apps.users.urls")),
    path("shops/", include("platform_apps.shops.urls")),
    path("platform/", include("platform_apps.platform_admin.urls")),
]
