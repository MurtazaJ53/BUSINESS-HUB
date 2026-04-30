from django.urls import path

from platform_apps.users.views import SessionBootstrapView

urlpatterns = [
    path("", SessionBootstrapView.as_view(), name="session-bootstrap"),
]
