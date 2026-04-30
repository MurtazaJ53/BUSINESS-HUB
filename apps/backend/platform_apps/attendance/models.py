from __future__ import annotations

from decimal import Decimal

from django.db import models

from platform_apps.common.models import SourceTrackedModel
from platform_apps.shops.models import Shop, ShopMembership


class AttendanceSession(SourceTrackedModel):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Present"
        ABSENT = "ABSENT", "Absent"
        HALF_DAY = "HALF_DAY", "Half day"
        LEAVE = "LEAVE", "Leave"

    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name="attendance_sessions")
    membership = models.ForeignKey(ShopMembership, on_delete=models.CASCADE, related_name="attendance_sessions")
    session_date = models.DateField()
    clock_in_at = models.DateTimeField(blank=True, null=True)
    clock_out_at = models.DateTimeField(blank=True, null=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ABSENT)
    total_hours = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    overtime_hours = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal("0.00"))
    bonus_amount = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    note = models.TextField(blank=True)
    tombstone = models.BooleanField(default=False)

    class Meta:
        ordering = ["-session_date", "-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["shop", "membership", "session_date"], name="uniq_attendance_per_day"),
        ]
        indexes = [
            models.Index(fields=["shop", "session_date"]),
            models.Index(fields=["membership", "session_date"]),
            models.Index(fields=["shop", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.membership_id} @ {self.session_date}"
