from __future__ import annotations

from django.conf import settings
from django.db import models

from platform_apps.common.models import SourceTrackedModel


class Shop(SourceTrackedModel):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    legal_name = models.CharField(max_length=255, blank=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    currency_code = models.CharField(max_length=8, default="INR")
    is_active = models.BooleanField(default=True)

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

    class Meta:
        unique_together = ("user", "shop")

    def __str__(self) -> str:
        return f"{self.user} -> {self.shop} ({self.role})"
