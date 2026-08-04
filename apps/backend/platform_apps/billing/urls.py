from __future__ import annotations

from django.urls import path

from platform_apps.billing.views import RazorpayWebhookView

urlpatterns = [
    # Unauthenticated (HMAC-verified) callback from Razorpay.
    path("razorpay/", RazorpayWebhookView.as_view(), name="razorpay-webhook"),
]
