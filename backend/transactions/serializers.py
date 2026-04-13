from rest_framework import serializers

from core.permissions import can_access_user, is_manager
from core.utils import quantize_amount
from core.permissions import can_access_user

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
from .services import (
    calculate_budget_usage,
    calculate_goal_projection,
    convert_amount,
    infer_category_for_transaction,
    infer_transaction_type,
    parse_bill_scan,
    signed_amount,
)


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = (
            "id",
            "name",
            "provider",
            "institution_name",
            "account_type",
            "currency",
            "balance",
            "available_balance",
            "external_id",
            "link_status",
            "consent_expires_at",
            "last_synced_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("external_id", "created_at", "updated_at")


class BankCredentialSerializer(serializers.ModelSerializer):
    has_refresh_token = serializers.SerializerMethodField()

    class Meta:
        model = BankCredential
        fields = ("provider_item_id", "access_token", "refresh_token", "scope", "expires_at", "has_refresh_token")
        extra_kwargs = {
            "access_token": {"write_only": True},
            "refresh_token": {"write_only": True},
        }

    def get_has_refresh_token(self, obj):
        return bool(obj.refresh_token)


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "kind", "parent", "created_at")
        read_only_fields = ("created_at",)


class TransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = Transaction
        fields = (
            "id",
            "account",
            "account_name",
            "date",
            "description",
            "merchant_name",
            "notes",
            "amount",
            "transaction_type",
            "category",
            "category_name",
            "is_manual",
            "is_recurring",
            "recurring_frequency",
            "next_occurrence_date",
            "external_transaction_id",
            "sync_source",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at", "external_transaction_id")

    def validate_account(self, value):
        request = self.context.get("request")
        if request and not can_access_user(request.user, value.user):
            raise serializers.ValidationError("You can only use accounts you own or are assigned to manage.")
        return value

    def validate_category(self, value):
        request = self.context.get("request")
        if value and request and not can_access_user(request.user, value.user):
            raise serializers.ValidationError("You can only use categories you own or are assigned to manage.")
        return value

    def validate(self, attrs):
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        transaction_type = attrs.get("transaction_type", getattr(self.instance, "transaction_type", ""))
        description = attrs.get("description", getattr(self.instance, "description", ""))
        merchant_name = attrs.get("merchant_name", getattr(self.instance, "merchant_name", ""))
        category = attrs.get("category", getattr(self.instance, "category", None))
        request = self.context.get("request")

        if amount is None:
            raise serializers.ValidationError({"amount": "Amount is required."})

        transaction_type = infer_transaction_type(amount, transaction_type)
        attrs["transaction_type"] = transaction_type
        attrs["amount"] = signed_amount(amount, transaction_type)

        if attrs["amount"] == 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than zero."})

        if attrs.get("is_recurring") and not attrs.get("recurring_frequency", getattr(self.instance, "recurring_frequency", "")):
            raise serializers.ValidationError({"recurring_frequency": "Recurring frequency is required."})

        if request and not category:
            attrs["category"] = infer_category_for_transaction(
                request.user,
                merchant_name or description,
                transaction_type,
            )
        return attrs


class BudgetSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    spent_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    usage_percentage = serializers.SerializerMethodField()
    alert_triggered = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    user = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = Budget
        fields = (
            "id",
            "user",
            "name",
            "category",
            "category_name",
            "period",
            "limit_amount",
            "alert_threshold",
            "spent_amount",
            "remaining_amount",
            "usage_percentage",
            "alert_triggered",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_category(self, value):
        request = self.context.get("request")
        if value and request and not can_access_user(request.user, value.user):
            raise serializers.ValidationError("You can only use categories you own or are assigned to manage.")
        return value

    def validate_user(self, value):
        request = self.context.get("request")
        if value and request:
            from django.contrib.auth.models import User
            try:
                target_user = User.objects.get(id=value)
                if not can_access_user(request.user, target_user):
                    raise serializers.ValidationError("You can only create budgets for users you manage.")
                return target_user
            except User.DoesNotExist:
                raise serializers.ValidationError("Invalid user.")
        return request.user if request else None

    def _usage(self, obj):
        return calculate_budget_usage(obj)

    def get_spent_amount(self, obj):
        return self._usage(obj)["spent_amount"]

    def get_remaining_amount(self, obj):
        return self._usage(obj)["remaining_amount"]

    def get_usage_percentage(self, obj):
        return self._usage(obj)["usage_percentage"]

    def get_alert_triggered(self, obj):
        return self._usage(obj)["alert_triggered"]

    def get_status(self, obj):
        return self._usage(obj)["status"]


class GoalSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()
    estimated_completion_date = serializers.SerializerMethodField()
    is_on_track = serializers.SerializerMethodField()
    linked_account_name = serializers.CharField(source="linked_account.name", read_only=True)
    user = serializers.IntegerField(required=False, write_only=True)

    class Meta:
        model = Goal
        fields = (
            "id",
            "user",
            "name",
            "goal_type",
            "linked_account",
            "linked_account_name",
            "target_amount",
            "current_amount",
            "monthly_contribution_target",
            "due_date",
            "progress_percentage",
            "remaining_amount",
            "estimated_completion_date",
            "is_on_track",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate_linked_account(self, value):
        request = self.context.get("request")
        if value and request and not can_access_user(request.user, value.user):
            raise serializers.ValidationError("You can only link accounts you own or are assigned to manage.")
        return value

    def validate_user(self, value):
        request = self.context.get("request")
        if value and request:
            from django.contrib.auth.models import User
            try:
                target_user = User.objects.get(id=value)
                if not can_access_user(request.user, target_user):
                    raise serializers.ValidationError("You can only create goals for users you manage.")
                return target_user
            except User.DoesNotExist:
                raise serializers.ValidationError("Invalid user.")
        return request.user if request else None

    def validate(self, attrs):
        target = quantize_amount(attrs.get("target_amount", getattr(self.instance, "target_amount", 0)))
        current = quantize_amount(attrs.get("current_amount", getattr(self.instance, "current_amount", 0)))
        if target <= 0:
            raise serializers.ValidationError({"target_amount": "Target amount must be greater than zero."})
        if current < 0:
            raise serializers.ValidationError({"current_amount": "Current amount cannot be negative."})
        return attrs

    def _projection(self, obj):
        return calculate_goal_projection(obj)

    def get_progress_percentage(self, obj):
        return self._projection(obj)["progress_percentage"]

    def get_remaining_amount(self, obj):
        return self._projection(obj)["remaining_amount"]

    def get_estimated_completion_date(self, obj):
        return self._projection(obj)["estimated_completion_date"]

    def get_is_on_track(self, obj):
        return self._projection(obj)["is_on_track"]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = (
            "id",
            "notification_type",
            "channel",
            "severity",
            "title",
            "message",
            "metadata",
            "is_read",
            "sent_at",
            "read_at",
            "created_at",
        )
        read_only_fields = ("sent_at", "read_at", "created_at")


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = ("id", "event_type", "resource_type", "resource_id", "message", "metadata", "ip_address", "created_at")
        read_only_fields = fields


class ExchangeRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExchangeRate
        fields = ("id", "base_currency", "quote_currency", "rate", "source", "valid_at", "created_at")
        read_only_fields = ("created_at",)


class InvestmentHoldingSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)
    market_value = serializers.SerializerMethodField()
    unrealized_gain_loss = serializers.SerializerMethodField()

    class Meta:
        model = InvestmentHolding
        fields = (
            "id",
            "account",
            "account_name",
            "symbol",
            "name",
            "asset_class",
            "quantity",
            "cost_basis",
            "current_price",
            "currency",
            "market_value",
            "unrealized_gain_loss",
            "last_synced_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("last_synced_at", "created_at", "updated_at")

    def validate_account(self, value):
        request = self.context.get("request")
        if value and request and value.user != request.user:
            raise serializers.ValidationError("You can only use your own accounts.")
        return value

    def get_market_value(self, obj):
        return quantize_amount(obj.quantity * obj.current_price)

    def get_unrealized_gain_loss(self, obj):
        return quantize_amount((obj.quantity * obj.current_price) - (obj.quantity * obj.cost_basis))


class PaymentRequestSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = PaymentRequest
        fields = (
            "id",
            "account",
            "account_name",
            "amount",
            "currency",
            "payee_name",
            "payee_reference",
            "iban",
            "scheduled_for",
            "status",
            "metadata",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("status", "created_at", "updated_at")

    def validate_account(self, value):
        request = self.context.get("request")
        if value and request and value.user != request.user:
            raise serializers.ValidationError("You can only use your own accounts.")
        return value


class BillScanSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillScan
        fields = (
            "id",
            "account",
            "file_name",
            "raw_text",
            "merchant_name",
            "extracted_amount",
            "extracted_date",
            "status",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("merchant_name", "extracted_amount", "extracted_date", "status", "created_at", "updated_at")

    def validate_account(self, value):
        request = self.context.get("request")
        if value and request and value.user != request.user:
            raise serializers.ValidationError("You can only use your own accounts.")
        return value

    def create(self, validated_data):
        scan = BillScan.objects.create(**validated_data)
        parsed = parse_bill_scan(scan.file_name, scan.raw_text)
        for field, value in parsed.items():
            setattr(scan, field, value)
        scan.save(update_fields=["merchant_name", "extracted_amount", "extracted_date", "status", "updated_at"])
        return scan
