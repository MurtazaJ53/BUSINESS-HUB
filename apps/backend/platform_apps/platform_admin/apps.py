from django.apps import AppConfig
import os

class PlatformAdminConfig(AppConfig):
    name = "platform_apps.platform_admin"
    verbose_name = "Platform Admin"

    def ready(self):
        # Auto-bootstrap platform admin from env on startup
        email = os.environ.get("BOOTSTRAP_ADMIN_EMAIL")
        if email:
            from django.contrib.auth import get_user_model
            try:
                User = get_user_model()
                user, created = User.objects.get_or_create(email=email)
                if not user.is_platform_admin:
                    user.is_platform_admin = True
                    if created:
                        user.set_unusable_password()
                    user.save()
            except Exception:
                pass
