import os

try:
    from celery import Celery
except ImportError:  # pragma: no cover - optional runtime dependency
    Celery = None


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "finance_manager.settings")


if Celery is not None:
    app = Celery("finance_manager")
    app.config_from_object("django.conf:settings", namespace="CELERY")
    app.autodiscover_tasks()
else:  # pragma: no cover - optional runtime dependency
    app = None
