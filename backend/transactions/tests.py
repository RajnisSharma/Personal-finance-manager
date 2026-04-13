from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core import mail
from django.urls import reverse
from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import Account, AuditLog, Budget, Category, Goal, Notification, Transaction
from users.models import ManagedUserAssignment
from .services import create_default_categories_for_user, evaluate_budget_alerts_for_user
from .tasks import send_pending_notifications_task


@override_settings(SECURE_SSL_REDIRECT=False)
class TransactionAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="tester", password="testpass123", email="tester@example.com")
        create_default_categories_for_user(self.user)
        self.account = Account.objects.create(
            user=self.user,
            name="Main Checking",
            provider="manual",
            institution_name="Demo Bank",
            account_type=Account.CHECKING,
            balance=Decimal("2500.00"),
            available_balance=Decimal("2400.00"),
        )
        response = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "tester", "password": "testpass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {response.data['access']}")

    def test_transaction_auto_categorizes_from_description(self):
        url = reverse("transaction-list")
        payload = {
            "account": self.account.id,
            "date": str(timezone.localdate()),
            "description": "Monthly grocery store shopping",
            "transaction_type": "expense",
            "amount": "75.25",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["category_name"], "Groceries")
        self.assertEqual(response.data["amount"], "-75.25")

    def test_budget_endpoint_returns_usage_metrics(self):
        groceries = Category.objects.get(user=self.user, name="Groceries", kind=Category.EXPENSE)
        Budget.objects.create(
            user=self.user,
            name="Family groceries",
            category=groceries,
            period=Budget.MONTHLY,
            limit_amount=Decimal("500.00"),
            alert_threshold=Decimal("80.00"),
        )
        Transaction.objects.create(
            account=self.account,
            date=timezone.localdate(),
            description="Weekly grocery run",
            amount=Decimal("-150.00"),
            transaction_type=Transaction.EXPENSE,
            category=groceries,
        )

        response = self.client.get(reverse("budget-list"))
        self.assertEqual(response.status_code, 200)
        budget = response.data["results"][0]
        self.assertEqual(str(budget["spent_amount"]), "150.00")
        self.assertEqual(str(budget["remaining_amount"]), "350.00")

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_budget_alerts_create_email_notification_and_send(self):
        groceries = Category.objects.get(user=self.user, name="Groceries", kind=Category.EXPENSE)
        Budget.objects.create(
            user=self.user,
            name="House groceries",
            category=groceries,
            period=Budget.MONTHLY,
            limit_amount=Decimal("100.00"),
            alert_threshold=Decimal("80.00"),
        )
        Transaction.objects.create(
            account=self.account,
            date=timezone.localdate(),
            description="Bulk grocery order",
            amount=Decimal("-95.00"),
            transaction_type=Transaction.EXPENSE,
            category=groceries,
        )

        created = evaluate_budget_alerts_for_user(self.user)
        self.assertEqual(len(created), 2)
        self.assertTrue(Notification.objects.filter(user=self.user, channel=Notification.EMAIL).exists())

        sent_count = send_pending_notifications_task()
        self.assertEqual(sent_count, 1)
        self.assertEqual(len(mail.outbox), 1)

    def test_dashboard_summary_endpoint(self):
        salary = Category.objects.get(user=self.user, name="Salary", kind=Category.INCOME)
        groceries = Category.objects.get(user=self.user, name="Groceries", kind=Category.EXPENSE)
        Transaction.objects.create(
            account=self.account,
            date=timezone.localdate(),
            description="Payroll",
            amount=Decimal("2000.00"),
            transaction_type=Transaction.INCOME,
            category=salary,
        )
        Transaction.objects.create(
            account=self.account,
            date=timezone.localdate(),
            description="Grocery run",
            amount=Decimal("-200.00"),
            transaction_type=Transaction.EXPENSE,
            category=groceries,
        )
        Goal.objects.create(
            user=self.user,
            name="Emergency fund",
            target_amount=Decimal("5000.00"),
            current_amount=Decimal("1500.00"),
            monthly_contribution_target=Decimal("300.00"),
            due_date=timezone.localdate() + timedelta(days=180),
        )

        response = self.client.get(reverse("summary"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(str(response.data["income_total"]), "2000.00")
        self.assertEqual(str(response.data["expense_total"]), "200.00")
        self.assertIn("spending_by_category", response.data)
        self.assertIn("goals", response.data)

    def test_manager_and_admin_multiuser_access(self):
        manager = User.objects.create_user(username="mgr", email="mgr@example.com", password="mgrpass")
        manager.profile.role = "manager"
        manager.profile.save(update_fields=["role", "updated_at"])

        assigned = User.objects.create_user(username="assign", email="assign@example.com", password="pass123")
        unassigned = User.objects.create_user(username="unassign", email="unassign@example.com", password="pass123")
        ManagedUserAssignment.objects.create(manager=manager, user=assigned)

        owner_account = Account.objects.create(
            user=assigned,
            name="Assigned Account",
            provider="manual",
            institution_name="Assigned Bank",
            account_type=Account.CHECKING,
            balance=Decimal("1000.00"),
            available_balance=Decimal("1000.00"),
        )
        outside_account = Account.objects.create(
            user=unassigned,
            name="Unassigned Account",
            provider="manual",
            institution_name="Other Bank",
            account_type=Account.CHECKING,
            balance=Decimal("500.00"),
            available_balance=Decimal("500.00"),
        )

        Transaction.objects.create(
            account=owner_account,
            date=timezone.localdate(),
            description="Assigned user transaction",
            amount=Decimal("-20.00"),
            transaction_type=Transaction.EXPENSE,
        )
        Transaction.objects.create(
            account=outside_account,
            date=timezone.localdate(),
            description="Unassigned user transaction",
            amount=Decimal("-15.00"),
            transaction_type=Transaction.EXPENSE,
        )

        # manager sees assigned user transaction only
        login = self.client.post(reverse("token_obtain_pair"), {"username": "mgr", "password": "mgrpass"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.get(reverse("transaction-list"))
        self.assertEqual(response.status_code, 200)
        descriptions = [item["description"] for item in response.data["results"]]
        self.assertIn("Assigned user transaction", descriptions)
        self.assertNotIn("Unassigned user transaction", descriptions)

        # admin sees all transactions
        admin = User.objects.create_superuser(username="admin2", email="admin2@example.com", password="adminpass")
        login = self.client.post(reverse("token_obtain_pair"), {"username": "admin2", "password": "adminpass"}, format="json")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = self.client.get(reverse("transaction-list"))
        self.assertEqual(response.status_code, 200)
        descriptions = [item["description"] for item in response.data["results"]]
        self.assertIn("Assigned user transaction", descriptions)
        self.assertIn("Unassigned user transaction", descriptions)

    def test_recurring_sync_creates_new_transaction(self):
        rent = Category.objects.get(user=self.user, name="Housing", kind=Category.EXPENSE)
        template = Transaction.objects.create(
            account=self.account,
            date=timezone.localdate() - timedelta(days=30),
            description="Rent payment",
            amount=Decimal("-1000.00"),
            transaction_type=Transaction.EXPENSE,
            category=rent,
            is_recurring=True,
            recurring_frequency=Transaction.MONTHLY,
            next_occurrence_date=timezone.localdate() - timedelta(days=1),
        )

        response = self.client.post(reverse("transaction-sync-recurring"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["created_count"], 1)
        template.refresh_from_db()
        self.assertGreater(template.next_occurrence_date, timezone.localdate())

    def test_export_csv_returns_rows(self):
        groceries = Category.objects.get(user=self.user, name="Groceries", kind=Category.EXPENSE)
        Transaction.objects.create(
            account=self.account,
            date=timezone.localdate(),
            description="Groceries",
            amount=Decimal("-42.00"),
            transaction_type=Transaction.EXPENSE,
            category=groceries,
        )

        response = self.client.get(reverse("export-csv"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn("Groceries", response.content.decode("utf-8"))

    def test_notification_mark_all_read_endpoint(self):
        Notification.objects.create(
            user=self.user,
            notification_type=Notification.SYNC,
            title="Sync complete",
            message="Account synced successfully.",
        )
        Notification.objects.create(
            user=self.user,
            notification_type=Notification.BUDGET_ALERT,
            title="Budget alert",
            message="Groceries budget is nearing the limit.",
        )

        response = self.client.post(reverse("notification-mark-all-read"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["updated"], 2)
        self.assertEqual(Notification.objects.filter(user=self.user, is_read=False).count(), 0)

    def test_investment_summary_endpoint(self):
        response = self.client.post(
            reverse("investment-list"),
            {
                "account": self.account.id,
                "symbol": "VTI",
                "name": "Vanguard Total Stock Market ETF",
                "asset_class": "etf",
                "quantity": "10.5",
                "cost_basis": "200.00",
                "current_price": "225.50",
                "currency": "USD",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201)

        summary = self.client.get(reverse("investment-summary"))
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.data["holdings"][0]["symbol"], "VTI")
        self.assertEqual(str(summary.data["portfolio_value"]), "2367.75")

    def test_payment_and_bill_scan_workflow(self):
        payment = self.client.post(
            reverse("payment-list"),
            {
                "account": self.account.id,
                "amount": "123.45",
                "currency": "USD",
                "payee_name": "Electric Co",
                "payee_reference": "INV-1001",
                "iban": "DE89370400440532013000",
            },
            format="json",
        )
        self.assertEqual(payment.status_code, 201)

        submit = self.client.post(reverse("payment-submit", kwargs={"pk": payment.data["id"]}))
        self.assertEqual(submit.status_code, 200)
        self.assertEqual(submit.data["status"], "completed")

        bill_scan = self.client.post(
            reverse("bill-scan-list"),
            {
                "account": self.account.id,
                "file_name": "water_bill_2026-04-01.pdf",
                "raw_text": "Utility bill total 124.50 due on 2026-04-01",
            },
            format="json",
        )
        self.assertEqual(bill_scan.status_code, 201)
        self.assertEqual(bill_scan.data["status"], "processed")
        self.assertEqual(str(bill_scan.data["extracted_amount"]), "124.50")
