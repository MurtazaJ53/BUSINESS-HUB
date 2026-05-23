from django.urls import path

from platform_apps.users.views import (
    SessionBootstrapView,
    SessionMfaDisableView,
    SessionMfaEnrollView,
    SessionMfaStatusView,
    SessionMfaVerifyView,
)

urlpatterns = [
    path("", SessionBootstrapView.as_view(), name="session-bootstrap"),
    path("mfa/", SessionMfaStatusView.as_view(), name="session-mfa-status"),
    path("mfa/enroll/", SessionMfaEnrollView.as_view(), name="session-mfa-enroll"),
    path("mfa/verify/", SessionMfaVerifyView.as_view(), name="session-mfa-verify"),
    path("mfa/disable/", SessionMfaDisableView.as_view(), name="session-mfa-disable"),
]
