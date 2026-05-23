from __future__ import annotations

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.plans import build_enabled_features, normalize_plan_tier


class Shop(SourceTrackedModel):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="owned_shops",
        blank=True,
        null=True,
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    legal_name = models.CharField(max_length=255, blank=True)
    invite_code = models.CharField(max_length=64, blank=True)
    settings_json = models.JSONField(default=dict, blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    currency_code = models.CharField(max_length=8, default="INR")
    is_active = models.BooleanField(default=True)

    @property
    def plan_tier(self) -> str:
        return normalize_plan_tier(self.settings_json.get("plan_tier"))

    @property
    def enabled_features(self) -> dict[str, bool]:
        explicit = self.settings_json.get("enabled_features")
        overrides = explicit if isinstance(explicit, dict) else None
        return build_enabled_features(self.plan_tier, overrides=overrides)

    def __str__(self) -> str:
        return self.name


class ShopMembership(SourceTrackedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        STAFF = "staff", "Staff"
        VIEWER = "viewer", "Viewer"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        INVITED = "invited", "Invited"
        DISABLED = "disabled", "Disabled"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.STAFF)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    permissions_version = models.PositiveIntegerField(default=1)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    permissions_json = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("user", "shop")

    def __str__(self) -> str:
        return f"{self.user} -> {self.shop} ({self.role})"


class ShopPlanRequest(SourceTrackedModel):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_REVIEW = "in_review", "In review"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="plan_requests")
    requested_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="shop_plan_requests",
    )
    current_plan_tier = models.CharField(max_length=16)
    requested_plan_tier = models.CharField(max_length=16)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    request_note = models.TextField(blank=True)
    context_json = models.JSONField(default=dict, blank=True)

    def __str__(self) -> str:
        return f"{self.shop} upgrade {self.current_plan_tier} -> {self.requested_plan_tier}"


class WorkspaceAccessSession(SourceTrackedModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REVOKED = "revoked", "Revoked"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="workspace_access_sessions",
    )
    shop = models.ForeignKey(
        Shop,
        on_delete=models.CASCADE,
        related_name="access_sessions",
    )
    membership = models.ForeignKey(
        ShopMembership,
        on_delete=models.SET_NULL,
        related_name="access_sessions",
        blank=True,
        null=True,
    )
    app_instance_id = models.CharField(max_length=128)
    membership_role_snapshot = models.CharField(max_length=16, default=ShopMembership.Role.STAFF)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    device_label = models.CharField(max_length=255)
    platform_name = models.CharField(max_length=64, blank=True)
    package_name = models.CharField(max_length=255, blank=True)
    app_version = models.CharField(max_length=64, blank=True)
    build_number = models.CharField(max_length=32, blank=True)
    release_channel = models.CharField(max_length=32, blank=True)
    release_tag = models.CharField(max_length=64, blank=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    revoked_at = models.DateTimeField(blank=True, null=True)
    revoked_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="revoked_workspace_access_sessions",
        blank=True,
        null=True,
    )
    revoke_reason = models.TextField(blank=True)
    wipe_requested_at = models.DateTimeField(blank=True, null=True)
    wipe_requested_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="wipe_requested_workspace_access_sessions",
        blank=True,
        null=True,
    )
    wipe_acknowledged_at = models.DateTimeField(blank=True, null=True)
    metadata_json = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("user", "shop", "app_instance_id")
        indexes = [
            models.Index(fields=["shop", "status", "last_seen_at"]),
            models.Index(fields=["user", "last_seen_at"]),
            models.Index(fields=["shop", "wipe_requested_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop}::{self.user}::{self.device_label}"
