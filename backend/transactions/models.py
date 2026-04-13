import uuid

from django.contrib.auth.models import User
from django.db import models


class Account(models.Model):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT = "credit"
    INVESTMENT = "investment"
    LOAN = "loan"

    ACCOUNT_TYPE_CHOICES = (
        (CHECKING, "Checking"),
        (SAVINGS, "Savings"),
        (CREDIT, "Credit Card"),
        (INVESTMENT, "Investment"),
        (LOAN, "Loan"),
    )

    MANUAL = "manual"
    LINKED = "linked"
    PENDING = "pending"
    ERROR = "error"
    REVOKED = "revoked"

    LINK_STATUS_CHOICES = (
        (MANUAL, "Manual"),
        (LINKED, "Linked"),
        (PENDING, "Pending"),
        (ERROR, "Error"),
        (REVOKED, "Revoked"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=100)
    provider = models.CharField(max_length=100)
    institution_name = models.CharField(max_length=120, blank=True)
    account_type = models.CharField(max_length=50, choices=ACCOUNT_TYPE_CHOICES, default=CHECKING)
    currency = models.CharField(max_length=3, default="USD")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    available_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    external_id = models.CharField(max_length=255, unique=True, blank=True)
    link_status = models.CharField(max_length=20, choices=LINK_STATUS_CHOICES, default=MANUAL)
    consent_expires_at = models.DateTimeField(blank=True, null=True)
    last_synced_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]

    def save(self, *args, **kwargs):
        if not self.external_id:
            self.external_id = f"acct_{uuid.uuid4().hex}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.provider})"


class BankCredential(models.Model):
    account = models.OneToOneField(Account, on_delete=models.CASCADE, related_name="credentials")
    provider_item_id = models.CharField(max_length=255, blank=True)
    access_token = models.TextField(blank=True)
    refresh_token = models.TextField(blank=True, null=True)
    scope = models.CharField(max_length=255, blank=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Credentials for {self.account}"


class Category(models.Model):
    EXPENSE = "expense"
    INCOME = "income"
    SAVINGS = "savings"
    DEBT = "debt"
    TRANSFER = "transfer"

    KIND_CHOICES = (
        (EXPENSE, "Expense"),
        (INCOME, "Income"),
        (SAVINGS, "Savings"),
        (DEBT, "Debt"),
        (TRANSFER, "Transfer"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="categories")
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=EXPENSE)
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.CASCADE, related_name="children")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "categories"
        ordering = ["kind", "name"]
        unique_together = ("user", "name", "kind")

    def __str__(self):
        return self.name


class Transaction(models.Model):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"
    REFUND = "refund"

    TYPE_CHOICES = (
        (INCOME, "Income"),
        (EXPENSE, "Expense"),
        (TRANSFER, "Transfer"),
        (REFUND, "Refund"),
    )

    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

    RECURRENCE_CHOICES = (
        (WEEKLY, "Weekly"),
        (BIWEEKLY, "Every 2 weeks"),
        (MONTHLY, "Monthly"),
        (QUARTERLY, "Quarterly"),
        (YEARLY, "Yearly"),
    )

    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="transactions")
    date = models.DateField()
    description = models.TextField(blank=True)
    merchant_name = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES, blank=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.SET_NULL, related_name="transactions")
    is_manual = models.BooleanField(default=True)
    is_recurring = models.BooleanField(default=False)
    recurring_frequency = models.CharField(max_length=20, choices=RECURRENCE_CHOICES, blank=True)
    next_occurrence_date = models.DateField(blank=True, null=True)
    external_transaction_id = models.CharField(max_length=255, blank=True, null=True, unique=True)
    sync_source = models.CharField(max_length=50, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "-created_at"]

    def __str__(self):
        return f"{self.amount} on {self.date} - {self.description}"


class Budget(models.Model):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

    PERIOD_CHOICES = (
        (MONTHLY, "Monthly"),
        (QUARTERLY, "Quarterly"),
        (YEARLY, "Yearly"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="budgets")
    name = models.CharField(max_length=100, blank=True)
    category = models.ForeignKey(Category, null=True, blank=True, on_delete=models.CASCADE, related_name="budgets")
    period = models.CharField(max_length=20, choices=PERIOD_CHOICES, default=MONTHLY)
    limit_amount = models.DecimalField(max_digits=12, decimal_places=2)
    alert_threshold = models.DecimalField(max_digits=5, decimal_places=2, default=90)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category__name", "id"]

    def __str__(self):
        label = self.name or (self.category.name if self.category else "Overall budget")
        return f"{label}: {self.limit_amount}"


class Goal(models.Model):
    SAVINGS = "savings"
    DEBT = "debt"

    GOAL_TYPE_CHOICES = (
        (SAVINGS, "Savings"),
        (DEBT, "Debt payoff"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="goals")
    name = models.CharField(max_length=100)
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPE_CHOICES, default=SAVINGS)
    linked_account = models.ForeignKey(Account, blank=True, null=True, on_delete=models.SET_NULL, related_name="goals")
    target_amount = models.DecimalField(max_digits=12, decimal_places=2)
    current_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    monthly_contribution_target = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["due_date", "id"]

    def __str__(self):
        return f"{self.name}: {self.current_amount}/{self.target_amount}"


class Notification(models.Model):
    BUDGET_ALERT = "budget_alert"
    LOW_BALANCE = "low_balance"
    LARGE_TRANSACTION = "large_transaction"
    GOAL_MILESTONE = "goal_milestone"
    SYNC = "sync"
    SECURITY = "security"
    PAYMENT = "payment"

    TYPE_CHOICES = (
        (BUDGET_ALERT, "Budget alert"),
        (LOW_BALANCE, "Low balance"),
        (LARGE_TRANSACTION, "Large transaction"),
        (GOAL_MILESTONE, "Goal milestone"),
        (SYNC, "Sync"),
        (SECURITY, "Security"),
        (PAYMENT, "Payment"),
    )

    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"

    CHANNEL_CHOICES = (
        (IN_APP, "In app"),
        (EMAIL, "Email"),
        (PUSH, "Push"),
    )

    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    CRITICAL = "critical"

    SEVERITY_CHOICES = (
        (INFO, "Info"),
        (SUCCESS, "Success"),
        (WARNING, "Warning"),
        (CRITICAL, "Critical"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="notifications")
    notification_type = models.CharField(max_length=30, choices=TYPE_CHOICES, default=SYNC)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES, default=IN_APP)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default=INFO)
    title = models.CharField(max_length=120)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    sent_at = models.DateTimeField(blank=True, null=True)
    read_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.user.username} - {self.title}"


class AuditLog(models.Model):
    user = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs")
    event_type = models.CharField(max_length=80)
    resource_type = models.CharField(max_length=80, blank=True)
    resource_id = models.CharField(max_length=80, blank=True)
    message = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.event_type}: {self.message[:40]}"


class ExchangeRate(models.Model):
    base_currency = models.CharField(max_length=3)
    quote_currency = models.CharField(max_length=3)
    rate = models.DecimalField(max_digits=18, decimal_places=6)
    source = models.CharField(max_length=50, default="manual")
    valid_at = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-valid_at", "base_currency", "quote_currency"]
        unique_together = ("base_currency", "quote_currency", "valid_at")

    def __str__(self):
        return f"1 {self.base_currency} = {self.rate} {self.quote_currency}"


class InvestmentHolding(models.Model):
    STOCK = "stock"
    ETF = "etf"
    MUTUAL_FUND = "mutual_fund"
    CRYPTO = "crypto"
    BOND = "bond"
    CASH = "cash"

    ASSET_CLASS_CHOICES = (
        (STOCK, "Stock"),
        (ETF, "ETF"),
        (MUTUAL_FUND, "Mutual Fund"),
        (CRYPTO, "Crypto"),
        (BOND, "Bond"),
        (CASH, "Cash"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="investment_holdings")
    account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name="holdings")
    symbol = models.CharField(max_length=20)
    name = models.CharField(max_length=120, blank=True)
    asset_class = models.CharField(max_length=20, choices=ASSET_CLASS_CHOICES, default=STOCK)
    quantity = models.DecimalField(max_digits=18, decimal_places=6, default=0)
    cost_basis = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="USD")
    last_synced_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["symbol", "id"]
        unique_together = ("user", "account", "symbol")

    def __str__(self):
        return self.symbol


class PaymentRequest(models.Model):
    INITIATED = "initiated"
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

    STATUS_CHOICES = (
        (INITIATED, "Initiated"),
        (PENDING, "Pending"),
        (COMPLETED, "Completed"),
        (FAILED, "Failed"),
        (CANCELLED, "Cancelled"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="payment_requests")
    account = models.ForeignKey(Account, on_delete=models.CASCADE, related_name="payment_requests")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="USD")
    payee_name = models.CharField(max_length=120)
    payee_reference = models.CharField(max_length=120, blank=True)
    iban = models.CharField(max_length=34, blank=True)
    scheduled_for = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=INITIATED)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.payee_name} - {self.amount}"


class BillScan(models.Model):
    PENDING = "pending"
    PROCESSED = "processed"
    FAILED = "failed"

    STATUS_CHOICES = (
        (PENDING, "Pending"),
        (PROCESSED, "Processed"),
        (FAILED, "Failed"),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="bill_scans")
    account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name="bill_scans")
    file_name = models.CharField(max_length=255)
    raw_text = models.TextField(blank=True)
    merchant_name = models.CharField(max_length=120, blank=True)
    extracted_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    extracted_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return self.file_name
