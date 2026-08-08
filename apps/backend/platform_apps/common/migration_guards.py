from __future__ import annotations

from rest_framework import exceptions, status

from platform_apps.common.migration import MigrationCutoverStatus, MigrationWriteMaster
from platform_apps.jobs.models import MigrationDomainControl


class MigrationWriteBlocked(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "migration_write_blocked"
    default_detail = "This domain is not writable on the PostgreSQL path yet."


class MigrationEpochStale(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "migration_epoch_stale"
    default_detail = "The client is attempting to write against a stale domain epoch."


def get_domain_control(*, shop_id: str, domain: str) -> MigrationDomainControl | None:
    control = (
        MigrationDomainControl.objects.filter(
            shop_id=shop_id,
            domain=domain,
            is_enabled=True,
        )
        .select_related("shop")
        .first()
    )
    return control


def assert_postgres_primary_write_enabled(*, shop_id: str, domain: str) -> MigrationDomainControl | None:
    control = get_domain_control(shop_id=shop_id, domain=domain)
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


def assert_postgres_primary_write_enabled_multi(
    *,
    shop_id: str,
    domains: list[str] | tuple[str, ...],
) -> dict[str, MigrationDomainControl | None]:
    controls: dict[str, MigrationDomainControl | None] = {}
    for domain in domains:
        controls[domain] = assert_postgres_primary_write_enabled(shop_id=shop_id, domain=domain)
    return controls


def assert_domain_epoch_current(*, shop_id: str, domain: str, base_domain_epoch: int) -> MigrationDomainControl | None:
    control = get_domain_control(shop_id=shop_id, domain=domain)
    if control is None:
        return None

    if int(base_domain_epoch) != int(control.current_epoch):
        raise MigrationEpochStale(
            {
                "detail": f"{domain} command was captured against epoch {base_domain_epoch}, but the current epoch is {control.current_epoch}.",
                "domain": domain,
                "base_domain_epoch": base_domain_epoch,
                "current_epoch": control.current_epoch,
                "write_master": control.write_master,
                "cutover_status": control.cutover_status,
            }
        )

    return control
