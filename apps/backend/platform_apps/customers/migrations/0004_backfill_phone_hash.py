from django.db import migrations

from platform_apps.common.blind_index import generate_blind_index


def backfill_phone_hash(apps, schema_editor):
    # Use the REAL model (not apps.get_model) so django-cryptography decrypts the
    # `phone` field; a one-time backfill of the blind index for existing rows.
    from platform_apps.customers.models import Customer

    # Query IDs first so we can load each Customer individually and handle decryption failures.
    ids = list(Customer.objects.values_list('pk', flat=True))
    for pk in ids:
        try:
            customer = Customer.objects.get(pk=pk)
            # Accessing phone triggers decryption
            phone_val = customer.phone
            new_hash = generate_blind_index(phone_val)
            if customer.phone_hash != new_hash:
                Customer.objects.filter(pk=pk).update(phone_hash=new_hash)
        except Exception:
            # Skip rows where decryption fails due to SECRET_KEY changes
            pass


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("customers", "0003_remove_customer_customers_c_shop_id_2daa30_idx_and_more"),
    ]

    operations = [migrations.RunPython(backfill_phone_hash, noop)]
