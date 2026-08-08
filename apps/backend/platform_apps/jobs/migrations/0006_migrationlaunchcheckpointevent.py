import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jobs", "0005_migrationphasecheckpointevent"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MigrationLaunchCheckpointEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("phase", models.CharField(default="phase_5", max_length=32)),
                (
                    "decision",
                    models.CharField(
                        choices=[
                            ("approved_for_launch", "Approved for launch"),
                            ("hold_for_hardening", "Hold for hardening"),
                            ("rollback_to_phase4", "Rollback to phase 4"),
                        ],
                        max_length=32,
                    ),
                ),
                ("overall_status_snapshot", models.CharField(blank=True, max_length=32)),
                ("summary", models.TextField(blank=True)),
                ("recommended_action_snapshot", models.TextField(blank=True)),
                ("metadata_json", models.JSONField(blank=True, default=dict)),
                ("occurred_at", models.DateTimeField()),
                (
                    "actor_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="migration_launch_checkpoint_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at", "-created_at"],
                "indexes": [
                    models.Index(fields=["phase", "occurred_at"], name="jobs_migrat_phase_14d00f_idx"),
                    models.Index(fields=["decision", "occurred_at"], name="jobs_migrat_decisio_086cca_idx"),
                    models.Index(fields=["overall_status_snapshot", "occurred_at"], name="jobs_migrat_overall_55fe40_idx"),
                ],
            },
        ),
    ]
