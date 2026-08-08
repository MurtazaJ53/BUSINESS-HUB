import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jobs", "0006_migrationlaunchcheckpointevent"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="MigrationGoLiveCheckpointEvent",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("phase", models.CharField(default="phase_6", max_length=32)),
                (
                    "decision",
                    models.CharField(
                        choices=[
                            ("execute_go_live", "Execute go-live"),
                            ("remain_in_hypercare", "Remain in hypercare"),
                            ("handoff_to_steady_state", "Handoff to steady state"),
                            ("rollback_launch", "Rollback launch"),
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
                        related_name="migration_go_live_checkpoint_events",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-occurred_at", "-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="migrationgolivecheckpointevent",
            index=models.Index(fields=["phase", "occurred_at"], name="jobs_migrat_phase_4a84ab_idx"),
        ),
        migrations.AddIndex(
            model_name="migrationgolivecheckpointevent",
            index=models.Index(fields=["decision", "occurred_at"], name="jobs_migrat_decisio_10b86e_idx"),
        ),
        migrations.AddIndex(
            model_name="migrationgolivecheckpointevent",
            index=models.Index(
                fields=["overall_status_snapshot", "occurred_at"],
                name="jobs_migrat_overall_9dca20_idx",
            ),
        ),
    ]
