from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountViewSet,
    AuditLogViewSet,
    BillScanViewSet,
    BudgetViewSet,
    CategoryViewSet,
    DashboardSummaryView,
    ExchangeRateViewSet,
    GoalViewSet,
    HealthCheckView,
    InvestmentHoldingViewSet,
    NotificationViewSet,
    PaymentRequestViewSet,
    TransactionExportCsvView,
    TransactionExportJsonView,
    TransactionViewSet,
    TransactionWebhookView,
)

router = DefaultRouter()
router.register(r"accounts", AccountViewSet, basename="account")
router.register(r"notifications", NotificationViewSet, basename="notification")
router.register(r"audit-logs", AuditLogViewSet, basename="audit-log")
router.register(r"exchange-rates", ExchangeRateViewSet, basename="exchange-rate")
router.register(r"investments", InvestmentHoldingViewSet, basename="investment")
router.register(r"payments", PaymentRequestViewSet, basename="payment")
router.register(r"bill-scans", BillScanViewSet, basename="bill-scan")
router.register(r"categories", CategoryViewSet, basename="category")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"budgets", BudgetViewSet, basename="budget")
router.register(r"goals", GoalViewSet, basename="goal")

urlpatterns = [
    path("dashboard/summary/", DashboardSummaryView.as_view(), name="dashboard-summary"),
    path("summary/", DashboardSummaryView.as_view(), name="summary"),
    path("export/csv/", TransactionExportCsvView.as_view(), name="export-csv"),
    path("export/json/", TransactionExportJsonView.as_view(), name="export-json"),
    path("webhooks/transactions/", TransactionWebhookView.as_view(), name="transaction-webhook"),
    path("health/", HealthCheckView.as_view(), name="health"),
    path("", include(router.urls)),
]
