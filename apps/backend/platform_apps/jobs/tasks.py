from __future__ import annotations

from celery import shared_task


@shared_task(bind=True)
def ping_task(self) -> dict[str, str]:
    return {"status": "ok", "task_id": self.request.id}
