from __future__ import annotations

from celery import shared_task

from platform_apps.jobs.services import execute_migration_job


@shared_task(bind=True)
def ping_task(self) -> dict[str, str]:
    return {"status": "ok", "task_id": self.request.id}


@shared_task(bind=True)
def backfill_domain_snapshot(self, job_run_id: str) -> dict[str, str]:
    job_run = execute_migration_job(job_run_id)
    return {
        "status": job_run.status,
        "job_run_id": str(job_run.id),
        "task_id": self.request.id,
        "rows_scanned": str(job_run.rows_scanned),
        "rows_written": str(job_run.rows_written),
    }


@shared_task(bind=True)
def run_shadow_compare(self, job_run_id: str) -> dict[str, str]:
    job_run = execute_migration_job(job_run_id)
    return {
        "status": job_run.status,
        "job_run_id": str(job_run.id),
        "task_id": self.request.id,
        "rows_scanned": str(job_run.rows_scanned),
        "mismatch_count": str(job_run.mismatch_count),
    }
