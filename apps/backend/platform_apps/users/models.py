from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.users.managers import PlatformUserManager


class PlatformUser(SourceTrackedModel, AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255, blank=True)
    firebase_uid = models.CharField(max_length=128, blank=True, null=True, unique=True)
    timezone = models.CharField(max_length=64, default="Asia/Kolkata")
    is_platform_admin = models.BooleanField(default=False)
    mfa_totp_secret = models.CharField(max_length=64, blank=True)
    mfa_totp_pending_secret = models.CharField(max_length=64, blank=True)
    mfa_totp_enabled_at = models.DateTimeField(blank=True, null=True)
    mfa_totp_last_verified_at = models.DateTimeField(blank=True, null=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = PlatformUserManager()

    @property
    def mfa_totp_enabled(self) -> bool:
        return bool(self.mfa_totp_secret and self.mfa_totp_enabled_at)

    def __str__(self) -> str:
        return self.full_name or self.email
