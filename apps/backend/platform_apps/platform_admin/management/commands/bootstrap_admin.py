import secrets

from django.core.management.base import BaseCommand
from platform_apps.users.models import PlatformUser

class Command(BaseCommand):
    help = "Bootstrap a platform administrator account."

    def add_arguments(self, parser):
        parser.add_argument(
            "email",
            type=str,
            help="Email address of the platform admin",
        )

    def handle(self, *args, **options):
        email = options["email"]
        
        user = PlatformUser.objects.filter(email=email).first()
        
        if user:
            if user.is_platform_admin:
                self.stdout.write(self.style.SUCCESS(f"User {email} is already a platform admin."))
            else:
                user.is_platform_admin = True
                user.save(update_fields=["is_platform_admin"])
                self.stdout.write(self.style.SUCCESS(f"User {email} has been upgraded to platform admin."))
        else:
            temp_password = secrets.token_urlsafe(16)
            user = PlatformUser.objects.create_user(
                email=email,
                full_name="Platform Admin",
                password=temp_password,
                is_platform_admin=True,
                is_active=True
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created new platform admin account.\n"
                    f"Email: {email}\n"
                    f"Temporary Password: {temp_password}\n"
                    f"Please log in and change this password immediately."
                )
            )
