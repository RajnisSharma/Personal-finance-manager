from django.contrib import admin

from .models import (
    Account,
    AuditLog,
    BankCredential,
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


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "provider", "account_type", "balance", "link_status", "last_synced_at")
    list_filter = ("provider", "account_type", "link_status", "currency")
    search_fields = ("name", "institution_name", "external_id", "user__username")


@admin.register(BankCredential)
class BankCredentialAdmin(admin.ModelAdmin):
    list_display = ("account", "provider_item_id", "expires_at", "updated_at")
    search_fields = ("account__name", "provider_item_id")


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "kind", "parent")
    list_filter = ("kind",)
    search_fields = ("name", "user__username")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("date", "account", "transaction_type", "amount", "category", "is_recurring")
    list_filter = ("transaction_type", "is_recurring", "account__provider")
    search_fields = ("description", "merchant_name", "account__name")
    autocomplete_fields = ("account", "category")


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "category", "period", "limit_amount", "alert_threshold")
    list_filter = ("period",)
    search_fields = ("name", "user__username", "category__name")


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "goal_type", "target_amount", "current_amount", "due_date")
    list_filter = ("goal_type",)
    search_fields = ("name", "user__username")


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("title", "user", "notification_type", "severity", "channel", "is_read", "created_at")
    list_filter = ("notification_type", "severity", "channel", "is_read")
    search_fields = ("title", "message", "user__username")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("event_type", "user", "resource_type", "resource_id", "created_at")
    list_filter = ("event_type", "resource_type")
    search_fields = ("message", "user__username", "resource_id")


@admin.register(ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ("base_currency", "quote_currency", "rate", "source", "valid_at")
    list_filter = ("base_currency", "quote_currency", "source")


@admin.register(InvestmentHolding)
class InvestmentHoldingAdmin(admin.ModelAdmin):
    list_display = ("symbol", "user", "account", "asset_class", "quantity", "current_price", "currency")
    list_filter = ("asset_class", "currency")
    search_fields = ("symbol", "name", "user__username")


@admin.register(PaymentRequest)
class PaymentRequestAdmin(admin.ModelAdmin):
    list_display = ("payee_name", "user", "account", "amount", "currency", "status", "scheduled_for")
    list_filter = ("status", "currency")
    search_fields = ("payee_name", "payee_reference", "user__username")


@admin.register(BillScan)
class BillScanAdmin(admin.ModelAdmin):
    list_display = ("file_name", "user", "merchant_name", "extracted_amount", "extracted_date", "status")
    list_filter = ("status",)
    search_fields = ("file_name", "merchant_name", "user__username")
