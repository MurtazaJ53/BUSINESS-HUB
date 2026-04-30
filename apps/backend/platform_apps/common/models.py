from __future__ import annotations

import uuid

from django.db import models


class UUIDStampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SourceTrackedModel(UUIDStampedModel):
    source_system = models.CharField(max_length=32, blank=True)
    source_id = models.CharField(max_length=128, blank=True)
    source_shop_id = models.CharField(max_length=128, blank=True)
    source_path = models.CharField(max_length=255, blank=True)
    migrated_at = models.DateTimeField(blank=True, null=True)
    domain_epoch = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True
