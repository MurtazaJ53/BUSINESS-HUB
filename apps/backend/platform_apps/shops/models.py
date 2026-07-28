from __future__ import annotations
import uuid
from django.conf import settings
from django.core.cache import cache
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
    # GST registration (India). gstin is the 15-char GST number; state_code is the
    # 2-digit GST state code used to decide intra-state (CGST+SGST) vs inter-state
    # (IGST) on each sale. region_code selects the localisation profile (IN/UK).
    region_code = models.CharField(max_length=8, default="IN")
    gstin = models.CharField(max_length=15, blank=True)
    state_code = models.CharField(max_length=2, blank=True)
    is_active = models.BooleanField(default=True)

    class Status(models.TextChoices):
        PENDING = "pending", "Pending approval"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"

    # Platform lifecycle state, controlled by platform admins. A suspended shop
    # blocks all member access at get_membership_or_403 (the single choke-point).
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE
    )
    status_reason = models.CharField(max_length=280, blank=True)

    @property
    def plan_tier(self) -> str:
        return normalize_plan_tier(self.settings_json.get("plan_tier"))

    @property
    def enabled_features(self) -> dict[str, bool]:
        cache_key = f"shop:{self.id}:enabled_features"
        cached_features = cache.get(cache_key)
        if cached_features is not None:
            return cached_features

        explicit = self.settings_json.get("enabled_features")
        overrides = explicit if isinstance(explicit, dict) else None
        features = build_enabled_features(self.plan_tier, overrides=overrides)
        
        # Cache for 1 hour
        cache.set(cache_key, features, 3600)
        return features

    def save(self, *args, **kwargs):
        # Invalidate cache when shop is saved
        cache.delete(f"shop:{self.id}:enabled_features")
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class ShopMembership(SourceTrackedModel):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MANAGER = "manager", "Manager"
        SUPERVISOR = "supervisor", "Supervisor"
        ACCOUNTANT = "accountant", "Accountant"
        HR = "hr", "HR"
        CASHIER = "cashier", "Cashier"
        SALES_STAFF = "sales_staff", "Sales Staff"
        INVENTORY_STAFF = "inventory_staff", "Inventory Staff"
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
    pos_pin_hash = models.CharField(max_length=128, blank=True)
    permissions_json = models.JSONField(default=dict, blank=True)

    class Meta:
        unique_together = ("user", "shop")

    def __str__(self) -> str:
        return f"{self.user} -> {self.shop} ({self.role})"


class ShopInvite(SourceTrackedModel):
    """A pending invitation for someone to join a shop with a given role.

    The token is the secret credential (delivered by email / link / QR). An
    invite is single-use and time-boxed; accepting it creates or activates the
    invitee's membership.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        REVOKED = "revoked", "Revoked"
        EXPIRED = "expired", "Expired"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="invites")
    token = models.CharField(max_length=64, unique=True, db_index=True)
    email = models.EmailField()
    role = models.CharField(
        max_length=16,
        choices=ShopMembership.Role.choices,
        default=ShopMembership.Role.STAFF,
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.PENDING
    )
    invited_by_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sent_invites",
    )
    message = models.CharField(max_length=280, blank=True)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["shop", "status"]),
            models.Index(fields=["email"]),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"invite {self.email} -> {self.shop} ({self.role}, {self.status})"

    @property
    def is_live(self) -> bool:
        from django.utils import timezone

        return (
            self.status == self.Status.PENDING and self.expires_at > timezone.now()
        )


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
    # Captured server-side from the request for the devices screen.
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.CharField(max_length=400, blank=True)
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
