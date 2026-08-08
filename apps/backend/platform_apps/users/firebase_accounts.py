from __future__ import annotations

from firebase_admin import auth as firebase_auth

from platform_apps.users.authentication import get_firebase_app


def ensure_firebase_email_account(*, email: str, full_name: str = "") -> bool:
    app = get_firebase_app()
    if app is None:
        return False

    normalized_email = email.strip().lower()
    if not normalized_email:
        return False

    try:
        firebase_auth.get_user_by_email(normalized_email, app=app)
        return False
    except Exception:
        pass

    try:
        firebase_auth.create_user(
            email=normalized_email,
            display_name=full_name.strip() or None,
            app=app,
        )
        return True
    except Exception:
        return False
