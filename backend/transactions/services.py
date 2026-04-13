from __future__ import annotations

import calendar
import math
import re
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.utils import timezone

from core.utils import quantize_amount
from core.permissions import get_accessible_user_ids

from .models import (
    Account,
    AuditLog,
    BillScan,
    Budget,
    Category,
    ExchangeRate,
    Goal,
    InvestmentHolding,
    Notification,
    PaymentRequest,
    Transaction,
)


DEFAULT_CATEGORIES = (
    {"name": "Salary", "kind": Category.INCOME},
    {"name": "Freelance", "kind": Category.INCOME},
    {"name": "Groceries", "kind": Category.EXPENSE},
    {"name": "Housing", "kind": Category.EXPENSE},
    {"name": "Utilities", "kind": Category.EXPENSE},
    {"name": "Dining", "kind": Category.EXPENSE},
    {"name": "Transport", "kind": Category.EXPENSE},
    {"name": "Entertainment", "kind": Category.EXPENSE},
    {"name": "Emergency Fund", "kind": Category.SAVINGS},
    {"name": "Debt Payment", "kind": Category.DEBT},
)


AUTO_CATEGORY_RULES = {
    "Salary": ("salary", "payroll", "bonus"),
    "Freelance": ("invoice", "freelance", "consulting", "client payment"),
    "Groceries": ("grocery", "supermarket", "mart", "fresh"),
    "Housing": ("rent", "mortgage", "lease"),
    "Utilities": ("electric", "water", "gas bill", "internet", "phone bill", "utility"),
    "Dining": ("restaurant", "coffee", "cafe", "dining", "food delivery"),
    "Transport": ("uber", "lyft", "fuel", "petrol", "metro", "bus", "train", "parking"),
    "Entertainment": ("movie", "netflix", "spotify", "concert", "game"),
    "Debt Payment": ("loan payment", "emi", "credit card payment"),
}


def create_default_categories_for_user(user):
    categories = []
    for item in DEFAULT_CATEGORIES:
        category, _ = Category.objects.get_or_create(
            user=user,
            name=item["name"],
            kind=item["kind"],
        )
        categories.append(category)
    return categories


DEFAULT_EXCHANGE_RATES = {
    ("USD", "USD"): Decimal("1.000000"),
    ("USD", "EUR"): Decimal("0.920000"),
    ("USD", "INR"): Decimal("83.100000"),
    ("USD", "GBP"): Decimal("0.790000"),
    ("EUR", "USD"): Decimal("1.087000"),
    ("EUR", "EUR"): Decimal("1.000000"),
    ("EUR", "INR"): Decimal("90.400000"),
    ("EUR", "GBP"): Decimal("0.860000"),
    ("INR", "USD"): Decimal("0.012000"),
    ("INR", "EUR"): Decimal("0.011000"),
    ("INR", "INR"): Decimal("1.000000"),
    ("INR", "GBP"): Decimal("0.009500"),
    ("GBP", "USD"): Decimal("1.265000"),
    ("GBP", "EUR"): Decimal("1.160000"),
    ("GBP", "INR"): Decimal("105.200000"),
    ("GBP", "GBP"): Decimal("1.000000"),
}


def ensure_default_exchange_rates(reference_date=None):
    reference_date = reference_date or timezone.localdate()
    for (base_currency, quote_currency), rate in DEFAULT_EXCHANGE_RATES.items():
        ExchangeRate.objects.get_or_create(
            base_currency=base_currency,
            quote_currency=quote_currency,
            valid_at=reference_date,
            defaults={"rate": rate, "source": "seeded"},
        )


def get_latest_exchange_rate(base_currency, quote_currency, reference_date=None):
    base_currency = (base_currency or settings.PFM_BASE_CURRENCY).upper()
    quote_currency = (quote_currency or settings.PFM_BASE_CURRENCY).upper()
    reference_date = reference_date or timezone.localdate()

    if base_currency == quote_currency:
        return Decimal("1.000000")

    ensure_default_exchange_rates(reference_date)
    latest = (
        ExchangeRate.objects.filter(
            base_currency=base_currency,
            quote_currency=quote_currency,
            valid_at__lte=reference_date,
        )
        .order_by("-valid_at")
        .first()
    )
    if latest:
        return latest.rate

    inverse = (
        ExchangeRate.objects.filter(
            base_currency=quote_currency,
            quote_currency=base_currency,
            valid_at__lte=reference_date,
        )
        .order_by("-valid_at")
        .first()
    )
    if inverse and inverse.rate:
        return Decimal("1.000000") / inverse.rate
    return Decimal("1.000000")


def convert_amount(amount, source_currency, target_currency, reference_date=None):
    source_currency = (source_currency or settings.PFM_BASE_CURRENCY).upper()
    target_currency = (target_currency or settings.PFM_BASE_CURRENCY).upper()
    rate = get_latest_exchange_rate(source_currency, target_currency, reference_date=reference_date)
    return quantize_amount(Decimal(amount) * rate)


def get_user_base_currency(user):
    profile = getattr(user, "profile", None)
    return getattr(profile, "base_currency", settings.PFM_BASE_CURRENCY).upper()


def create_notification(
    user,
    notification_type,
    title,
    message,
    *,
    channel=Notification.IN_APP,
    severity=Notification.INFO,
    metadata=None,
):
    profile = getattr(user, "profile", None)
    if channel == Notification.IN_APP and profile and not profile.in_app_notifications:
        return None
    if channel == Notification.EMAIL and profile and not profile.email_notifications:
        return None
    if channel == Notification.PUSH and profile and not profile.push_notifications:
        return None

    return Notification.objects.create(
        user=user,
        notification_type=notification_type,
        title=title,
        message=message,
        channel=channel,
        severity=severity,
        metadata=metadata or {},
    )


def create_audit_log(user, event_type, message, *, resource_type="", resource_id="", metadata=None, ip_address=None):
    return AuditLog.objects.create(
        user=user,
        event_type=event_type,
        resource_type=resource_type,
        resource_id=str(resource_id or ""),
        message=message,
        metadata=metadata or {},
        ip_address=ip_address,
    )


def infer_transaction_type(amount, declared_type=""):
    if declared_type:
        return declared_type
    amount = Decimal(amount)
    return Transaction.INCOME if amount >= 0 else Transaction.EXPENSE


def signed_amount(amount, transaction_type):
    normalized = quantize_amount(amount)
    if normalized is None:
        return normalized
    if transaction_type in {Transaction.EXPENSE, Category.DEBT}:
        return -abs(normalized)
    if transaction_type in {Transaction.INCOME, Transaction.REFUND}:
        return abs(normalized)
    if transaction_type == Transaction.TRANSFER:
        return normalized
    return normalized


def infer_category_for_transaction(user, description, transaction_type):
    if not description:
        return None

    lowered = description.lower()
    for category_name, keywords in AUTO_CATEGORY_RULES.items():
        if any(keyword in lowered for keyword in keywords):
            kind = Category.INCOME if transaction_type == Transaction.INCOME else Category.EXPENSE
            if category_name == "Debt Payment":
                kind = Category.DEBT
            return (
                Category.objects.filter(user=user, name__iexact=category_name, kind=kind).first()
                or Category.objects.filter(user=user, name__iexact=category_name).first()
            )
    return None


def add_months(source_date, months):
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return source_date.replace(year=year, month=month, day=day)


def next_recurring_date(current_date, frequency):
    if frequency == Transaction.WEEKLY:
        return current_date + timedelta(days=7)
    if frequency == Transaction.BIWEEKLY:
        return current_date + timedelta(days=14)
    if frequency == Transaction.MONTHLY:
        return add_months(current_date, 1)
    if frequency == Transaction.QUARTERLY:
        return add_months(current_date, 3)
    if frequency == Transaction.YEARLY:
        return add_months(current_date, 12)
    return None


def current_period_bounds(period, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    start = reference_date.replace(day=1)

    if period == Budget.MONTHLY:
        end = add_months(start, 1) - timedelta(days=1)
        return start, end

    if period == Budget.QUARTERLY:
        quarter_start_month = ((reference_date.month - 1) // 3) * 3 + 1
        start = reference_date.replace(month=quarter_start_month, day=1)
        end = add_months(start, 3) - timedelta(days=1)
        return start, end

    start = reference_date.replace(month=1, day=1)
    end = reference_date.replace(month=12, day=31)
    return start, end


def calculate_budget_usage(budget, reference_date=None):
    start_date, end_date = current_period_bounds(budget.period, reference_date=reference_date)
    base_currency = get_user_base_currency(budget.user)
    transactions = Transaction.objects.filter(
        account__user=budget.user,
        date__gte=start_date,
        date__lte=end_date,
    ).select_related("account")

    if budget.category:
        transactions = transactions.filter(category=budget.category)

    spent = Decimal("0.00")
    for item in transactions:
        converted_amount = convert_amount(item.amount, item.account.currency, base_currency, reference_date=end_date)
        if converted_amount < 0 or item.transaction_type in {Transaction.EXPENSE, Transaction.TRANSFER}:
            spent += abs(converted_amount)

    spent = quantize_amount(spent)
    remaining = max(quantize_amount(budget.limit_amount - spent), Decimal("0.00"))
    usage = Decimal("0.00")
    if budget.limit_amount:
        usage = quantize_amount((spent / budget.limit_amount) * Decimal("100"))

    if spent > budget.limit_amount:
        status = "over_budget"
    elif usage >= budget.alert_threshold:
        status = "warning"
    else:
        status = "healthy"

    return {
        "spent_amount": spent,
        "remaining_amount": remaining,
        "usage_percentage": usage,
        "alert_triggered": usage >= budget.alert_threshold,
        "status": status,
        "period_start": start_date,
        "period_end": end_date,
    }


def calculate_goal_projection(goal, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    target = quantize_amount(goal.target_amount)
    current = quantize_amount(goal.current_amount)
    remaining = max(quantize_amount(target - current), Decimal("0.00"))
    progress = Decimal("0.00")
    if target:
        progress = quantize_amount((current / target) * Decimal("100"))

    elapsed_days = max((reference_date - goal.created_at.date()).days, 1)
    elapsed_months = max(elapsed_days / 30.0, 1.0)
    inferred_monthly_rate = quantize_amount(current / Decimal(str(elapsed_months)))
    monthly_rate = goal.monthly_contribution_target or inferred_monthly_rate

    estimated_completion_date = None
    if remaining == Decimal("0.00"):
        estimated_completion_date = reference_date
    elif monthly_rate and monthly_rate > 0:
        months_needed = math.ceil(remaining / monthly_rate)
        estimated_completion_date = add_months(reference_date, months_needed)

    is_on_track = None
    if estimated_completion_date:
        is_on_track = estimated_completion_date <= goal.due_date

    return {
        "progress_percentage": progress,
        "remaining_amount": remaining,
        "monthly_rate": quantize_amount(monthly_rate or Decimal("0.00")),
        "estimated_completion_date": estimated_completion_date,
        "is_on_track": is_on_track,
    }


def generate_due_recurring_transactions(user=None, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    queryset = Transaction.objects.select_related("account", "category", "account__user").filter(
        is_recurring=True,
        next_occurrence_date__isnull=False,
        next_occurrence_date__lte=reference_date,
    )
    if user is not None:
        queryset = queryset.filter(account__user=user)

    created = []
    for template in queryset:
        next_date = template.next_occurrence_date
        while next_date and next_date <= reference_date:
            duplicate = Transaction.objects.filter(
                account=template.account,
                date=next_date,
                description=template.description,
                amount=template.amount,
                sync_source="recurring",
                is_manual=False,
            ).exists()
            if not duplicate:
                created.append(
                    Transaction.objects.create(
                        account=template.account,
                        date=next_date,
                        description=template.description,
                        merchant_name=template.merchant_name,
                        notes=template.notes,
                        amount=template.amount,
                        transaction_type=template.transaction_type,
                        category=template.category,
                        is_manual=False,
                        is_recurring=False,
                        recurring_frequency="",
                        next_occurrence_date=None,
                        sync_source="recurring",
                    )
                )
            next_date = next_recurring_date(next_date, template.recurring_frequency)
        template.next_occurrence_date = next_date
        template.save(update_fields=["next_occurrence_date", "updated_at"])
    return created


def evaluate_budget_alerts_for_user(user, reference_date=None):
    reference_date = reference_date or timezone.localdate()
    created_notifications = []
    for budget in Budget.objects.filter(user=user).select_related("category"):
        usage = calculate_budget_usage(budget, reference_date=reference_date)
        if usage["alert_triggered"]:
            title = f"Budget alert: {budget.name or budget.category.name if budget.category else 'Overall budget'}"
            message = (
                f"You have used {usage['usage_percentage']}% of your "
                f"{quantize_amount(budget.limit_amount)} budget."
            )
            severity = Notification.WARNING if usage["status"] == "warning" else Notification.CRITICAL
            metadata = {"budget_id": budget.id, "status": usage["status"]}
            for channel in (Notification.IN_APP, Notification.EMAIL):
                already_sent_today = Notification.objects.filter(
                    user=user,
                    notification_type=Notification.BUDGET_ALERT,
                    channel=channel,
                    title=title,
                    created_at__date=reference_date,
                ).exists()
                if already_sent_today:
                    continue
                notification = create_notification(
                    user,
                    Notification.BUDGET_ALERT,
                    title,
                    message,
                    channel=channel,
                    severity=severity,
                    metadata=metadata,
                )
                if notification:
                    created_notifications.append(notification)
    return created_notifications


def simulate_account_sync(account):
    today = timezone.localdate()
    created_transactions = []

    templates = [
        {
            "description": f"{account.name} statement sync",
            "merchant_name": account.institution_name or account.provider,
            "amount": Decimal("25.00") if account.account_type in {Account.CREDIT, Account.LOAN} else Decimal("-25.00"),
            "transaction_type": Transaction.EXPENSE if account.account_type not in {Account.INVESTMENT} else Transaction.TRANSFER,
        },
        {
            "description": "Payroll deposit" if account.account_type in {Account.CHECKING, Account.SAVINGS} else "Monthly transfer",
            "merchant_name": "Demo Provider",
            "amount": Decimal("1250.00") if account.account_type in {Account.CHECKING, Account.SAVINGS} else Decimal("0.00"),
            "transaction_type": Transaction.INCOME if account.account_type in {Account.CHECKING, Account.SAVINGS} else Transaction.TRANSFER,
        },
    ]

    for index, item in enumerate(templates):
        if item["amount"] == 0:
            continue
        external_id = f"sync_{account.id}_{today.isoformat()}_{index}"
        transaction, created = Transaction.objects.get_or_create(
            external_transaction_id=external_id,
            defaults={
                "account": account,
                "date": today,
                "description": item["description"],
                "merchant_name": item["merchant_name"],
                "amount": signed_amount(item["amount"], item["transaction_type"]),
                "transaction_type": item["transaction_type"],
                "category": infer_category_for_transaction(account.user, item["description"], item["transaction_type"]),
                "is_manual": False,
                "sync_source": "provider_sync",
            },
        )
        if created:
            created_transactions.append(transaction)

    account.last_synced_at = timezone.now()
    account.link_status = Account.LINKED if account.link_status != Account.MANUAL else Account.MANUAL
    balance_delta = sum((item.amount for item in created_transactions), Decimal("0.00"))
    account.balance = quantize_amount(account.balance + balance_delta)
    account.available_balance = quantize_amount(account.available_balance + balance_delta)
    account.save(update_fields=["last_synced_at", "link_status", "balance", "available_balance", "updated_at"])
    create_audit_log(
        account.user,
        "account.sync",
        f"Synchronized account {account.name}",
        resource_type="account",
        resource_id=account.id,
        metadata={"created_transactions": len(created_transactions)},
    )
    return created_transactions


def investment_snapshot_for_user(user, base_currency=None, reference_date=None):
    base_currency = (base_currency or get_user_base_currency(user)).upper()
    reference_date = reference_date or timezone.localdate()
    holdings = list(InvestmentHolding.objects.filter(user=user).select_related("account"))
    payload = []
    total_market_value = Decimal("0.00")
    total_cost_basis = Decimal("0.00")

    for holding in holdings:
        market_value = quantize_amount(holding.quantity * holding.current_price)
        cost_value = quantize_amount(holding.quantity * holding.cost_basis)
        converted_market_value = convert_amount(market_value, holding.currency, base_currency, reference_date=reference_date)
        converted_cost_value = convert_amount(cost_value, holding.currency, base_currency, reference_date=reference_date)
        total_market_value += converted_market_value
        total_cost_basis += converted_cost_value
        payload.append(
            {
                "id": holding.id,
                "symbol": holding.symbol,
                "name": holding.name or holding.symbol,
                "asset_class": holding.asset_class,
                "quantity": holding.quantity,
                "cost_basis": quantize_amount(holding.cost_basis),
                "current_price": quantize_amount(holding.current_price),
                "market_value": converted_market_value,
                "unrealized_gain_loss": quantize_amount(converted_market_value - converted_cost_value),
                "currency": holding.currency,
                "base_currency": base_currency,
            }
        )

    return {
        "base_currency": base_currency,
        "portfolio_value": quantize_amount(total_market_value),
        "total_cost_basis": quantize_amount(total_cost_basis),
        "unrealized_gain_loss": quantize_amount(total_market_value - total_cost_basis),
        "holdings": payload,
    }


def investment_snapshot_for_users(user_ids, base_currency=None, reference_date=None):
    base_currency = (base_currency or settings.PFM_BASE_CURRENCY).upper()
    reference_date = reference_date or timezone.localdate()
    holdings = list(InvestmentHolding.objects.filter(user_id__in=user_ids).select_related("account"))
    payload = []
    total_market_value = Decimal("0.00")
    total_cost_basis = Decimal("0.00")

    for holding in holdings:
        market_value = quantize_amount(holding.quantity * holding.current_price)
        cost_value = quantize_amount(holding.quantity * holding.cost_basis)
        converted_market_value = convert_amount(market_value, holding.currency, base_currency, reference_date=reference_date)
        converted_cost_value = convert_amount(cost_value, holding.currency, base_currency, reference_date=reference_date)
        total_market_value += converted_market_value
        total_cost_basis += converted_cost_value
        payload.append(
            {
                "id": holding.id,
                "symbol": holding.symbol,
                "name": holding.name or holding.symbol,
                "asset_class": holding.asset_class,
                "quantity": holding.quantity,
                "cost_basis": quantize_amount(holding.cost_basis),
                "current_price": quantize_amount(holding.current_price),
                "market_value": converted_market_value,
                "unrealized_gain_loss": quantize_amount(converted_market_value - converted_cost_value),
                "currency": holding.currency,
                "base_currency": base_currency,
            }
        )

    return {
        "base_currency": base_currency,
        "portfolio_value": quantize_amount(total_market_value),
        "total_cost_basis": quantize_amount(total_cost_basis),
        "unrealized_gain_loss": quantize_amount(total_market_value - total_cost_basis),
        "holdings": payload,
    }


def parse_bill_scan(file_name, raw_text=""):
    raw_text = raw_text or ""
    normalized_text = f"{file_name} {raw_text}"
    amount_match = re.search(r"(\d+[.,]\d{2})", normalized_text)
    date_match = re.search(r"(\d{4}-\d{2}-\d{2})", normalized_text)

    extracted_amount = quantize_amount(amount_match.group(1).replace(",", ".")) if amount_match else None
    extracted_date = date.fromisoformat(date_match.group(1)) if date_match else None
    merchant_name = file_name.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip().title()
    status = BillScan.PROCESSED if extracted_amount else BillScan.FAILED
    return {
        "merchant_name": merchant_name,
        "extracted_amount": extracted_amount,
        "extracted_date": extracted_date,
        "status": status,
    }


def export_user_financial_data(user):
    summary = build_dashboard_summary(user)
    investments = investment_snapshot_for_user(user, base_currency=summary["base_currency"])
    return {
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "profile": {
                "base_currency": getattr(user.profile, "base_currency", settings.PFM_BASE_CURRENCY),
                "email_notifications": getattr(user.profile, "email_notifications", True),
                "push_notifications": getattr(user.profile, "push_notifications", False),
                "in_app_notifications": getattr(user.profile, "in_app_notifications", True),
                "two_factor_enabled": getattr(user.profile, "two_factor_enabled", False),
            },
        },
        "summary": summary,
        "categories": list(user.categories.values("id", "name", "kind", "parent_id")),
        "transactions": list(
            Transaction.objects.filter(account__user=user).values(
                "id",
                "account_id",
                "date",
                "description",
                "merchant_name",
                "amount",
                "transaction_type",
                "category_id",
                "is_recurring",
                "recurring_frequency",
                "sync_source",
            )
        ),
        "budgets": list(user.budgets.values()),
        "goals": list(user.goals.values()),
        "notifications": list(user.notifications.values("id", "title", "message", "notification_type", "severity", "is_read", "created_at")),
        "audit_logs": list(user.audit_logs.values("event_type", "message", "resource_type", "resource_id", "created_at")),
        "payments": list(user.payment_requests.values()),
        "bill_scans": list(user.bill_scans.values()),
        "investments": investments,
    }


def build_dashboard_summary(user, start_date=None, end_date=None):
    if isinstance(start_date, str) and start_date:
        start_date = date.fromisoformat(start_date)
    if isinstance(end_date, str) and end_date:
        end_date = date.fromisoformat(end_date)

    start_date = start_date or timezone.localdate().replace(day=1)
    end_date = end_date or timezone.localdate()
    base_currency = get_user_base_currency(user)

    user_ids = get_accessible_user_ids(user)

    if user_ids is None:
        accounts = list(Account.objects.all())
        transaction_filter = Transaction.objects.all()
        budget_filter = Budget.objects.all()
        goal_filter = Goal.objects.all()
        investments = investment_snapshot_for_users(User.objects.values_list("id", flat=True), base_currency=base_currency, reference_date=end_date)
    else:
        accounts = list(Account.objects.filter(user_id__in=user_ids))
        transaction_filter = Transaction.objects.filter(account__user_id__in=user_ids)
        budget_filter = Budget.objects.filter(user_id__in=user_ids)
        goal_filter = Goal.objects.filter(user_id__in=user_ids)
        investments = investment_snapshot_for_users(user_ids, base_currency=base_currency, reference_date=end_date)

    transactions = list(
        transaction_filter.filter(date__gte=start_date, date__lte=end_date).select_related("category", "account")
    )
    historical_transactions = list(
        transaction_filter.filter(
            date__gte=add_months(start_date, -5),
            date__lte=end_date,
        ).select_related("category", "account")
    )
    budgets = budget_filter.select_related("category")
    goals = goal_filter.select_related("linked_account")

    net_worth = Decimal("0.00")
    available_cash = Decimal("0.00")
    for account in accounts:
        net_worth += convert_amount(account.balance, account.currency, base_currency, reference_date=end_date)
        available_cash += convert_amount(account.available_balance, account.currency, base_currency, reference_date=end_date)
    income = Decimal("0.00")
    expenses = Decimal("0.00")
    spending_by_category = {}
    for item in transactions:
        converted_amount = convert_amount(item.amount, item.account.currency, base_currency, reference_date=end_date)
        if converted_amount > 0:
            income += converted_amount
        if item.amount < 0:
            category_name = item.category.name if item.category else "Uncategorized"
            amount_value = abs(converted_amount)
            expenses += amount_value
            spending_by_category[category_name] = spending_by_category.get(category_name, Decimal("0.00")) + amount_value

    budget_payload = []
    for budget in budgets:
        usage = calculate_budget_usage(budget, reference_date=end_date)
        budget_payload.append(
            {
                "id": budget.id,
                "name": budget.name or (budget.category.name if budget.category else "Overall budget"),
                "category_name": budget.category.name if budget.category else "All categories",
                "limit_amount": quantize_amount(budget.limit_amount),
                **usage,
            }
        )

    goal_payload = []
    for goal in goals:
        projection = calculate_goal_projection(goal, reference_date=end_date)
        goal_payload.append(
            {
                "id": goal.id,
                "name": goal.name,
                "goal_type": goal.goal_type,
                "target_amount": quantize_amount(goal.target_amount),
                "current_amount": quantize_amount(goal.current_amount),
                "due_date": goal.due_date,
                **projection,
            }
        )

    six_months_ago = add_months(start_date, -5)
    monthly_cashflow = []
    month_cursor = six_months_ago.replace(day=1)
    for _ in range(6):
        month_transactions = [
            item for item in historical_transactions if item.date.year == month_cursor.year and item.date.month == month_cursor.month
        ]
        month_income = Decimal("0.00")
        month_expense = Decimal("0.00")
        month_total = Decimal("0.00")
        for item in month_transactions:
            converted_amount = convert_amount(item.amount, item.account.currency, base_currency, reference_date=end_date)
            month_total += converted_amount
            if converted_amount > 0:
                month_income += converted_amount
            elif converted_amount < 0:
                month_expense += abs(converted_amount)
        monthly_cashflow.append(
            {
                "month": month_cursor.strftime("%b %Y"),
                "income": quantize_amount(month_income),
                "expense": quantize_amount(month_expense),
                "balance": quantize_amount(month_total),
            }
        )
        month_cursor = add_months(month_cursor, 1)

    top_transactions = sorted(transactions, key=lambda item: abs(item.amount), reverse=True)[:3]

    return {
        "period": {"start": start_date, "end": end_date},
        "net_worth": quantize_amount(net_worth),
        "available_cash": quantize_amount(available_cash),
        "income_total": quantize_amount(income),
        "expense_total": quantize_amount(expenses),
        "savings_delta": quantize_amount(income - expenses),
        "linked_accounts": len(accounts),
        "budget_alerts": sum(1 for item in budget_payload if item["alert_triggered"]),
        "accounts": [
            {
                "id": account.id,
                "name": account.name,
                "provider": account.provider,
                "institution_name": account.institution_name,
                "account_type": account.account_type,
                "currency": account.currency,
                "balance": quantize_amount(account.balance),
                "available_balance": quantize_amount(account.available_balance),
                "balance_in_base_currency": convert_amount(account.balance, account.currency, base_currency, reference_date=end_date),
                "available_balance_in_base_currency": convert_amount(
                    account.available_balance, account.currency, base_currency, reference_date=end_date
                ),
                "link_status": account.link_status,
                "last_synced_at": account.last_synced_at,
            }
            for account in accounts
        ],
        "spending_by_category": [
            {"name": name, "value": quantize_amount(value)}
            for name, value in sorted(spending_by_category.items(), key=lambda item: item[1], reverse=True)
        ],
        "monthly_cashflow": monthly_cashflow,
        "top_transactions": [
            {
                "id": item.id,
                "date": item.date,
                "description": item.description,
                "amount": convert_amount(item.amount, item.account.currency, base_currency, reference_date=end_date),
                "source_amount": quantize_amount(item.amount),
                "currency": item.account.currency,
                "category_name": item.category.name if item.category else "Uncategorized",
                "account_name": item.account.name,
            }
            for item in top_transactions
        ],
        "budgets": budget_payload,
        "goals": goal_payload,
        "base_currency": base_currency,
        "portfolio": investments,
        "unread_notifications": Notification.objects.filter(user=user, is_read=False).count(),
    }
