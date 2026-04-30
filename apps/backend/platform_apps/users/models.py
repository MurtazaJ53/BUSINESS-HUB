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

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = PlatformUserManager()

    def __str__(self) -> str:
        return self.full_name or self.email
