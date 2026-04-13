try:
    from celery import shared_task
except ImportError:  # pragma: no cover - optional runtime dependency
    def shared_task(*args, **kwargs):  # type: ignore
        def decorator(func):
            return func

        if args and callable(args[0]):
            return args[0]
        return decorator

from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.utils import timezone

from .models import Account, Notification
from .services import create_notification, evaluate_budget_alerts_for_user, generate_due_recurring_transactions, simulate_account_sync


@shared_task
def generate_recurring_transactions_task():
    created = generate_due_recurring_transactions()
    return len(created)


@shared_task
def sync_linked_accounts_task():
    synced = 0
    for account in Account.objects.exclude(link_status=Account.MANUAL):
        simulate_account_sync(account)
        synced += 1
    return synced


@shared_task
def create_budget_alert_notifications_task():
    created = 0
    for user in User.objects.all():
        created += len(evaluate_budget_alerts_for_user(user))
    return created


@shared_task
def send_pending_notifications_task():
    notifications = Notification.objects.filter(channel=Notification.EMAIL, sent_at__isnull=True)[:50]
    for notification in notifications:
        send_mail(
            notification.title,
            notification.message,
            None,
            [notification.user.email] if notification.user.email else [],
            fail_silently=True,
        )
        notification.sent_at = timezone.now()
        notification.save(update_fields=["sent_at"])
    return notifications.count()


@shared_task
def notify_low_balance_task(account_id):
    account = Account.objects.select_related("user").get(id=account_id)
    profile = getattr(account.user, "profile", None)
    threshold = getattr(profile, "low_balance_threshold", 100)
    if account.available_balance <= threshold:
        create_notification(
            account.user,
            Notification.LOW_BALANCE,
            "Low balance warning",
            f"{account.name} is below your threshold with {account.available_balance} {account.currency} available.",
            severity=Notification.WARNING,
            metadata={"account_id": account.id, "threshold": str(threshold)},
        )
        return True
    return False
