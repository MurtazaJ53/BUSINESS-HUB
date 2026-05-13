from __future__ import annotations

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: list[str] | None = None) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default or []
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ENVIRONMENT = os.getenv("DJANGO_ENV", "development")
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", ["localhost", "127.0.0.1", "testserver"])
CORS_ALLOWED_ORIGINS = env_list("DJANGO_CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "platform_apps.common.apps.CommonConfig",
    "platform_apps.health.apps.HealthConfig",
    "platform_apps.users.apps.UsersConfig",
    "platform_apps.shops.apps.ShopsConfig",
    "platform_apps.inventory.apps.InventoryConfig",
    "platform_apps.customers.apps.CustomersConfig",
    "platform_apps.sales.apps.SalesConfig",
    "platform_apps.payments.apps.PaymentsConfig",
    "platform_apps.expenses.apps.ExpensesConfig",
    "platform_apps.attendance.apps.AttendanceConfig",
    "platform_apps.projections.apps.ProjectionsConfig",
    "platform_apps.jobs.apps.JobsConfig",
    "platform_apps.audit.apps.AuditConfig",
    "platform_apps.erpnext.apps.ERPNextConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    DATABASES = {
        "default": dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=int(os.getenv("DATABASE_CONN_MAX_AGE", "600")),
            ssl_require=env_bool("DATABASE_SSL_REQUIRED", False),
        )
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "dev.sqlite3",
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-in"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "Asia/Kolkata")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "users.PlatformUser"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "platform_apps.users.authentication.FirebaseAuthentication",
        "platform_apps.users.authentication.DevHeaderAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": int(os.getenv("API_PAGE_SIZE", "50")),
}

REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CACHES = {
    "default": {
        "BACKEND": (
            "django.core.cache.backends.redis.RedisCache"
            if REDIS_URL.startswith("redis://") or REDIS_URL.startswith("rediss://")
            else "django.core.cache.backends.locmem.LocMemCache"
        ),
        "LOCATION": REDIS_URL if REDIS_URL.startswith("redis") else "business-hub-dev-cache",
    }
}

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "300"))

OTEL_SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "business-hub-backend")

ERPNEXT_BASE_URL = os.getenv("ERPNEXT_BASE_URL", "").rstrip("/")
ERPNEXT_API_KEY = os.getenv("ERPNEXT_API_KEY", "")
ERPNEXT_API_SECRET = os.getenv("ERPNEXT_API_SECRET", "")
ERPNEXT_SITE_NAME = os.getenv("ERPNEXT_SITE_NAME", "")
ERPNEXT_VERIFY_SSL = env_bool("ERPNEXT_VERIFY_SSL", True)
ERPNEXT_TIMEOUT_SECONDS = int(os.getenv("ERPNEXT_TIMEOUT_SECONDS", "15"))
ERPNEXT_MOCK_MODE = env_bool("ERPNEXT_MOCK_MODE", False)
ERPNEXT_MOCK_STATE_PATH = os.getenv(
    "ERPNEXT_MOCK_STATE_PATH",
    str(BASE_DIR / ".erpnext-mock-state.json"),
)
ERPNEXT_CYCLE_BEAT_ENABLED = env_bool("ERPNEXT_CYCLE_BEAT_ENABLED", True)
ERPNEXT_CYCLE_BEAT_MINUTES = int(os.getenv("ERPNEXT_CYCLE_BEAT_MINUTES", "15"))
ERPNEXT_CYCLE_BEAT_LIMIT = int(os.getenv("ERPNEXT_CYCLE_BEAT_LIMIT", "100"))
