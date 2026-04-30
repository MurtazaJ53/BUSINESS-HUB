# Business Hub Backend

Phase 1 backend foundation for the Business Hub target platform.

## Stack

- Django
- Django REST Framework
- PostgreSQL (target source of truth)
- Redis
- Celery
- OpenTelemetry

## Quick start

1. Create or activate the local virtual environment.
2. Install dependencies:
   - `python -m pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and adjust values as needed.
4. Run migrations:
   - `python manage.py migrate`
5. Start the API:
   - `python manage.py runserver`

## Useful endpoints

- `/api/v1/`
- `/api/v1/health/`
- `/api/v1/health/ready/`
- `/admin/`

## Local infrastructure

Use `docker-compose.yml` to run PostgreSQL and Redis for the Tier A local stack.
