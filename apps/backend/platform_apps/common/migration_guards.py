from __future__ import annotations

from rest_framework import exceptions, status

from platform_apps.common.migration import MigrationCutoverStatus, MigrationWriteMaster
from platform_apps.jobs.models import MigrationDomainControl


class MigrationWriteBlocked(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "migration_write_blocked"
    default_detail = "This domain is not writable on the PostgreSQL path yet."


def assert_postgres_primary_write_enabled(*, shop_id: str, domain: str) -> MigrationDomainControl | None:
    control = (
        MigrationDomainControl.objects.filter(
            shop_id=shop_id,
            domain=domain,
            is_enabled=True,
        )
        .select_related("shop")
        .first()
    )
    if control is None:
        return None

    if (
        control.write_master != MigrationWriteMaster.POSTGRES
        or control.cutover_status != MigrationCutoverStatus.POSTGRES_PRIMARY
    ):
        raise MigrationWriteBlocked(
            {
                "detail": f"{domain} writes are still owned by the legacy path for this shop.",
                "domain": domain,
                "write_master": control.write_master,
                "cutover_status": control.cutover_status,
                "current_epoch": control.current_epoch,
            }
        )

    return control
