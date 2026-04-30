from __future__ import annotations

from celery import shared_task


@shared_task(bind=True)
def ping_task(self) -> dict[str, str]:
    return {"status": "ok", "task_id": self.request.id}


@shared_task(bind=True)
def backfill_domain_snapshot(self, job_run_id: str) -> dict[str, str]:
    return {"status": "queued", "job_run_id": job_run_id, "task_id": self.request.id}


@shared_task(bind=True)
def run_shadow_compare(self, job_run_id: str) -> dict[str, str]:
    return {"status": "queued", "job_run_id": job_run_id, "task_id": self.request.id}
