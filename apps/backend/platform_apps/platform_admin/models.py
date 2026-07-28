from django.db import models
from django.conf import settings
from platform_apps.common.models import UUIDStampedModel

class PlatformAuditEvent(UUIDStampedModel):
    actor_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='platform_audit_events')
    shop = models.ForeignKey('shops.Shop', on_delete=models.SET_NULL, null=True, blank=True, related_name='platform_audit_events')
    action = models.CharField(max_length=64)
    reason = models.TextField(blank=True)
    before_json = models.JSONField(default=dict)
    after_json = models.JSONField(default=dict)
    metadata_json = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(blank=True, null=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['shop', '-created_at']),
            models.Index(fields=['action', '-created_at']),
        ]

    def __str__(self):
        return f"{self.action} on {self.shop_id or 'platform'}"
