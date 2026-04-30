from django.urls import path

from platform_apps.health.views import ReadinessView, SystemHealthView

urlpatterns = [
    path("", SystemHealthView.as_view(), name="health"),
    path("ready/", ReadinessView.as_view(), name="health-ready"),
]
