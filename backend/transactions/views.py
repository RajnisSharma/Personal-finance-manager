import csv
import base64
import hashlib
import hmac
import secrets
from django.db import transaction as db_transaction

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsOwnerOrAssignedManagerOrAdmin, get_accessible_user_ids, is_administrator

from .filters import TransactionFilter


def _scope_by_user(queryset, user, user_field="user"):
    user_ids = get_accessible_user_ids(user)
    if user_ids is None:
        return queryset
    return queryset.filter(**{f"{user_field}__id__in": user_ids})

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
from .serializers import (
    AccountSerializer,
    AuditLogSerializer,
    BankCredentialSerializer,
    BillScanSerializer,
    BudgetSerializer,
    CategorySerializer,
    ExchangeRateSerializer,
    GoalSerializer,
    InvestmentHoldingSerializer,
    NotificationSerializer,
    PaymentRequestSerializer,
    TransactionSerializer,
)
from .services import (
    build_dashboard_summary,
    create_audit_log,
    create_notification,
    evaluate_budget_alerts_for_user,
    generate_due_recurring_transactions,
    investment_snapshot_for_user,
    simulate_account_sync,
)


class AccountViewSet(viewsets.ModelViewSet):
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(Account.objects.all().prefetch_related("transactions"), self.request.user)

    def perform_create(self, serializer):
        account = serializer.save(user=self.request.user)
        create_audit_log(
            self.request.user,
            "account.create",
            f"Created account {account.name}",
            resource_type="account",
            resource_id=account.id,
        )

    def perform_destroy(self, instance):
        create_audit_log(
            self.request.user,
            "account.delete",
            f"Deleted account {instance.name}",
            resource_type="account",
            resource_id=instance.id,
        )
        instance.delete()

    @action(detail=True, methods=["get"])
    def transactions(self, request, pk=None):
        account = self.get_object()
        queryset = Transaction.objects.filter(account=account).select_related("category", "account")
        date_from = request.query_params.get("start") or request.query_params.get("date_from")
        date_to = request.query_params.get("end") or request.query_params.get("date_to")
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        serializer = TransactionSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="link/initiate")
    def initiate_link(self, request):
        provider = request.data.get("provider", "sandbox")
        state = secrets.token_urlsafe(24)
        code_verifier = secrets.token_urlsafe(48)
        code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode("utf-8")).digest()).rstrip(b"=").decode("utf-8")
        redirect_uri = request.data.get("redirect_uri", settings.PFM_DEFAULT_REDIRECT_URI)
        authorization_url = (
            f"{settings.PFM_OAUTH_AUTHORIZE_URL}"
            f"?response_type=code&client_id={settings.PFM_OAUTH_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}&scope=accounts transactions"
            f"&state={state}&code_challenge={code_challenge}&code_challenge_method=S256"
            f"&provider={provider}"
        )
        return Response(
            {
                "provider": provider,
                "state": state,
                "code_verifier": code_verifier,
                "code_challenge": code_challenge,
                "authorization_url": authorization_url,
                "redirect_uri": redirect_uri,
                "message": "Use the returned values with your bank or aggregator OAuth screen.",
            }
        )

    @action(detail=False, methods=["post"], url_path="link/complete")
    def complete_link(self, request):
        with db_transaction.atomic():
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            account = serializer.save(user=request.user, link_status=Account.LINKED, last_synced_at=timezone.now())

            credential_serializer = BankCredentialSerializer(data=request.data.get("credentials", {}))
            credential_serializer.is_valid(raise_exception=True)
            BankCredential.objects.update_or_create(account=account, defaults=credential_serializer.validated_data)

        create_notification(
            request.user,
            Notification.SYNC,
            "Account linked",
            f"{account.name} is now linked and ready to sync.",
            severity=Notification.SUCCESS,
            metadata={"account_id": account.id},
        )
        create_audit_log(
            request.user,
            "account.linked",
            f"Linked account {account.name}",
            resource_type="account",
            resource_id=account.id,
        )
        return Response(self.get_serializer(account).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def sync(self, request, pk=None):
        account = self.get_object()
        created_transactions = simulate_account_sync(account)
        evaluate_budget_alerts_for_user(request.user)
        return Response(
            {
                "synced_at": account.last_synced_at,
                "created_transactions": len(created_transactions),
                "transaction_ids": [item.id for item in created_transactions],
            }
        )


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(Category.objects.all(), self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrAssignedManagerOrAdmin]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_class = TransactionFilter
    ordering_fields = ["date", "amount", "created_at"]

    def get_queryset(self):
        queryset = Transaction.objects.all().select_related("account", "category")
        return _scope_by_user(queryset, self.request.user, user_field="account__user")

    def perform_create(self, serializer):
        transaction = serializer.save(sync_source=serializer.validated_data.get("sync_source", "manual"))
        create_audit_log(
            self.request.user,
            "transaction.create",
            f"Created transaction {transaction.description}",
            resource_type="transaction",
            resource_id=transaction.id,
        )
        evaluate_budget_alerts_for_user(self.request.user)

    def perform_update(self, serializer):
        transaction = serializer.save()
        create_audit_log(
            self.request.user,
            "transaction.update",
            f"Updated transaction {transaction.description}",
            resource_type="transaction",
            resource_id=transaction.id,
        )
        evaluate_budget_alerts_for_user(self.request.user)

    def perform_destroy(self, instance):
        create_audit_log(
            self.request.user,
            "transaction.delete",
            f"Deleted transaction {instance.description}",
            resource_type="transaction",
            resource_id=instance.id,
        )
        instance.delete()

    @action(detail=False, methods=["post"], url_path="sync/recurring")
    def sync_recurring(self, request):
        created = generate_due_recurring_transactions(request.user)
        return Response(
            {
                "created_count": len(created),
                "transaction_ids": [item.id for item in created],
            }
        )


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(Budget.objects.all().select_related("category"), self.request.user)

    def perform_create(self, serializer):
        user = serializer.validated_data.pop("user", self.request.user)
        budget = serializer.save(user=user)
        create_audit_log(
            self.request.user,
            "budget.create",
            f"Created budget {budget.name or budget.id} for {user.username}",
            resource_type="budget",
            resource_id=budget.id,
        )

    def perform_update(self, serializer):
        budget = serializer.save()
        create_audit_log(
            self.request.user,
            "budget.update",
            f"Updated budget {budget.name or budget.id}",
            resource_type="budget",
            resource_id=budget.id,
        )

    def perform_destroy(self, instance):
        create_audit_log(
            self.request.user,
            "budget.delete",
            f"Deleted budget {instance.name or instance.id}",
            resource_type="budget",
            resource_id=instance.id,
        )
        instance.delete()


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class = GoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(Goal.objects.all().select_related("linked_account"), self.request.user)

    def perform_create(self, serializer):
        user = serializer.validated_data.pop("user", self.request.user)
        goal = serializer.save(user=user)
        create_audit_log(
            self.request.user,
            "goal.create",
            f"Created goal {goal.name} for {user.username}",
            resource_type="goal",
            resource_id=goal.id,
        )

    def perform_update(self, serializer):
        goal = serializer.save()
        create_audit_log(
            self.request.user,
            "goal.update",
            f"Updated goal {goal.name}",
            resource_type="goal",
            resource_id=goal.id,
        )

    def perform_destroy(self, instance):
        create_audit_log(
            self.request.user,
            "goal.delete",
            f"Deleted goal {instance.name}",
            resource_type="goal",
            resource_id=instance.id,
        )
        instance.delete()


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(Notification.objects.all(), self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=["is_read", "read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True, read_at=timezone.now())
        return Response({"updated": count})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if is_administrator(self.request.user):
            return AuditLog.objects.all()
        return _scope_by_user(AuditLog.objects.all(), self.request.user)


class ExchangeRateViewSet(viewsets.ModelViewSet):
    serializer_class = ExchangeRateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExchangeRate.objects.all().order_by("-valid_at", "base_currency", "quote_currency")


class InvestmentHoldingViewSet(viewsets.ModelViewSet):
    serializer_class = InvestmentHoldingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(InvestmentHolding.objects.all().select_related("account"), self.request.user)

    def perform_create(self, serializer):
        holding = serializer.save(user=self.request.user, last_synced_at=timezone.now())
        create_audit_log(
            self.request.user,
            "investment.create",
            f"Created holding {holding.symbol}",
            resource_type="investment_holding",
            resource_id=holding.id,
        )

    def perform_update(self, serializer):
        holding = serializer.save(last_synced_at=timezone.now())
        create_audit_log(
            self.request.user,
            "investment.update",
            f"Updated holding {holding.symbol}",
            resource_type="investment_holding",
            resource_id=holding.id,
        )

    @action(detail=False, methods=["get"])
    def summary(self, request):
        return Response(investment_snapshot_for_user(request.user))


class PaymentRequestViewSet(viewsets.ModelViewSet):
    serializer_class = PaymentRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(PaymentRequest.objects.all().select_related("account"), self.request.user)

    def perform_create(self, serializer):
        payment = serializer.save(user=self.request.user, status=PaymentRequest.INITIATED)
        create_notification(
            self.request.user,
            Notification.PAYMENT,
            "Payment request created",
            f"Payment to {payment.payee_name} for {payment.amount} {payment.currency} created.",
            severity=Notification.INFO,
            metadata={"payment_id": payment.id},
        )
        create_audit_log(
            self.request.user,
            "payment.create",
            f"Created payment for {payment.payee_name}",
            resource_type="payment_request",
            resource_id=payment.id,
        )

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        payment = self.get_object()
        payment.status = PaymentRequest.PENDING if payment.scheduled_for else PaymentRequest.COMPLETED
        payment.metadata = {**payment.metadata, "submitted_at": timezone.now().isoformat()}
        payment.save(update_fields=["status", "metadata", "updated_at"])
        create_notification(
            request.user,
            Notification.PAYMENT,
            "Payment submitted",
            f"Payment to {payment.payee_name} is {payment.status}.",
            severity=Notification.SUCCESS if payment.status == PaymentRequest.COMPLETED else Notification.INFO,
            metadata={"payment_id": payment.id, "status": payment.status},
        )
        create_audit_log(
            request.user,
            "payment.submit",
            f"Submitted payment for {payment.payee_name}",
            resource_type="payment_request",
            resource_id=payment.id,
        )
        return Response(self.get_serializer(payment).data)


class BillScanViewSet(viewsets.ModelViewSet):
    serializer_class = BillScanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _scope_by_user(BillScan.objects.all().select_related("account"), self.request.user)

    def perform_create(self, serializer):
        scan = serializer.save(user=self.request.user)
        create_audit_log(
            self.request.user,
            "bill_scan.create",
            f"Processed bill scan {scan.file_name}",
            resource_type="bill_scan",
            resource_id=scan.id,
        )


class DashboardSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        start_date = request.query_params.get("start") or request.query_params.get("date_from")
        end_date = request.query_params.get("end") or request.query_params.get("date_to")
        summary = build_dashboard_summary(request.user, start_date=start_date, end_date=end_date)
        return Response(summary)


class TransactionExportCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Transaction.objects.all().select_related("account", "category")
        user_ids = get_accessible_user_ids(request.user)
        if user_ids is not None:
            queryset = queryset.filter(account__user__id__in=user_ids)
        filterset = TransactionFilter(request.query_params, queryset=queryset)
        queryset = filterset.qs.order_by("-date", "-created_at")

        response = HttpResponse(content_type="text/csv")
        timestamp = timezone.now().strftime("%Y%m%d_%H%M%S")
        response["Content-Disposition"] = f'attachment; filename="transactions_{timestamp}.csv"'

        writer = csv.writer(response)
        writer.writerow(
            [
                "Date",
                "Account",
                "Description",
                "Merchant",
                "Category",
                "Type",
                "Amount",
                "Recurring",
                "Currency",
            ]
        )
        for item in queryset:
            writer.writerow(
                [
                    item.date,
                    item.account.name,
                    item.description,
                    item.merchant_name,
                    item.category.name if item.category else "",
                    item.transaction_type,
                    item.amount,
                    "Yes" if item.is_recurring else "No",
                    item.account.currency,
                ]
            )
        return response


class TransactionExportJsonView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        summary = build_dashboard_summary(request.user)
        user_ids = get_accessible_user_ids(request.user)
        transactions_qs = Transaction.objects.all()
        if user_ids is not None:
            transactions_qs = transactions_qs.filter(account__user__id__in=user_ids)
        payload = {
            "summary": summary,
            "transactions": list(
                transactions_qs.values(
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
        }
        return Response(payload)


class TransactionWebhookView(APIView):
    permission_classes = []

    def post(self, request):
        secret = settings.PFM_WEBHOOK_SECRET.encode("utf-8")
        provided_signature = request.headers.get("X-PFM-Signature", "")
        computed_signature = hmac.new(secret, request.body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(provided_signature, computed_signature):
            return Response({"detail": "Invalid signature."}, status=status.HTTP_401_UNAUTHORIZED)

        account_id = request.data.get("account_id")
        if account_id:
            account = Account.objects.filter(id=account_id, user__isnull=False).first()
            if account:
                account.last_synced_at = timezone.now()
                account.save(update_fields=["last_synced_at", "updated_at"])
                create_notification(
                    account.user,
                    Notification.SYNC,
                    "Webhook update received",
                    f"Provider reported new activity for {account.name}.",
                    metadata={"account_id": account.id},
                )
                create_audit_log(
                    account.user,
                    "webhook.transactions",
                    f"Received transaction webhook for {account.name}",
                    resource_type="account",
                    resource_id=account.id,
                    metadata=request.data,
                )
        return Response({"status": "accepted"})


class HealthCheckView(APIView):
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "status": "ok",
                "timestamp": timezone.now(),
                "app": "personal-finance-manager",
                "recurring_sync_window_days": 30,
                "supports": ["2fa", "notifications", "audit_logs", "payments", "bill_scans", "investments"],
            }
        )
