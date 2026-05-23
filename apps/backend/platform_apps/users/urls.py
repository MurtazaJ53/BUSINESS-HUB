from django.urls import path

from platform_apps.users.views import (
    SessionBootstrapView,
    SessionMfaDisableView,
    SessionMfaEnrollView,
    SessionMfaStatusView,
    SessionMfaVerifyView,
    SessionPasskeyAssertionBeginView,
    SessionPasskeyAssertionFinishView,
    SessionPasskeyDeleteView,
    SessionPasskeyListView,
    SessionPasskeyRegistrationBeginView,
    SessionPasskeyRegistrationFinishView,
)

urlpatterns = [
    path("", SessionBootstrapView.as_view(), name="session-bootstrap"),
    path("mfa/", SessionMfaStatusView.as_view(), name="session-mfa-status"),
    path("mfa/enroll/", SessionMfaEnrollView.as_view(), name="session-mfa-enroll"),
    path("mfa/verify/", SessionMfaVerifyView.as_view(), name="session-mfa-verify"),
    path("mfa/disable/", SessionMfaDisableView.as_view(), name="session-mfa-disable"),
    path("passkeys/", SessionPasskeyListView.as_view(), name="session-passkey-list"),
    path(
        "passkeys/register/begin/",
        SessionPasskeyRegistrationBeginView.as_view(),
        name="session-passkey-register-begin",
    ),
    path(
        "passkeys/register/finish/",
        SessionPasskeyRegistrationFinishView.as_view(),
        name="session-passkey-register-finish",
    ),
    path(
        "passkeys/verify/begin/",
        SessionPasskeyAssertionBeginView.as_view(),
        name="session-passkey-verify-begin",
    ),
    path(
        "passkeys/verify/finish/",
        SessionPasskeyAssertionFinishView.as_view(),
        name="session-passkey-verify-finish",
    ),
    path(
        "passkeys/<uuid:passkey_id>/",
        SessionPasskeyDeleteView.as_view(),
        name="session-passkey-delete",
    ),
]
