from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from transactions.models import Account, Transaction
from transactions.services import create_default_categories_for_user
from decimal import Decimal
from django.utils import timezone
import random
from datetime import timedelta

class Command(BaseCommand):
    help = "Create demo users, categories, and transactions"

    def handle(self, *args, **options):
        user1, _ = User.objects.get_or_create(username="alice", defaults={"email":"alice@example.com"})
        user1.set_password("password123")
        user1.save()
        user2, _ = User.objects.get_or_create(username="bob", defaults={"email":"bob@example.com"})
        user2.set_password("password123")
        user2.save()

        for user in [user1, user2]:
            create_default_categories_for_user(user)
            account, _ = Account.objects.get_or_create(
                user=user,
                name="Primary Checking",
                defaults={
                    "provider": "manual",
                    "institution_name": "Demo Credit Union",
                    "account_type": Account.CHECKING,
                    "balance": Decimal("2500.00"),
                    "available_balance": Decimal("2400.00"),
                },
            )
            categories = {category.name: category for category in user.categories.all()}

            for i in range(15):
                date = timezone.now().date() - timedelta(days=random.randint(0, 90))
                tx_type = random.choice([Transaction.INCOME, Transaction.EXPENSE])
                amount = Decimal(random.randint(1000, 50000)) / Decimal(100)
                if tx_type == Transaction.EXPENSE:
                    amount = -amount
                    category = random.choice([categories["Groceries"], categories["Dining"], categories["Transport"]])
                else:
                    category = categories["Salary"]

                Transaction.objects.create(
                    account=account,
                    date=date,
                    transaction_type=tx_type,
                    description=f"Demo {tx_type} {i}",
                    amount=amount,
                    category=category,
                    notes="Demo data",
                )
        self.stdout.write(self.style.SUCCESS("Demo data created. Users: alice/password123, bob/password123"))
