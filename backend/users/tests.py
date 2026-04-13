from django.contrib.auth.models import User
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from core.utils import generate_totp_code
from transactions.models import Category
from users.models import ManagedUserAssignment, SystemSetting, UserProfile


@override_settings(SECURE_SSL_REDIRECT=False)
class AuthTests(APITestCase):
    def authenticate(self, username="demo", password="pass1234", email="demo@example.com"):
        user = User.objects.create_user(username=username, email=email, password=password)
        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": username, "password": password},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        return user, login

    def test_register_creates_tokens_and_default_categories(self):
        response = self.client.post(
            reverse("auth-register"),
            {"username": "demo", "email": "demo@example.com", "password": "pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["role"], UserProfile.USER)
        self.assertTrue(Category.objects.filter(user__username="demo", name="Groceries").exists())
        self.assertEqual(User.objects.get(username="demo").profile.role, UserProfile.USER)

    def test_login_returns_user_payload(self):
        User.objects.create_user(username="demo", email="demo@example.com", password="pass1234")
        response = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "demo", "password": "pass1234"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["user"]["username"], "demo")

    def test_logout_blacklists_refresh_token(self):
        User.objects.create_user(username="demo", email="demo@example.com", password="pass1234")
        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "demo", "password": "pass1234"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        logout = self.client.post(reverse("auth-logout"), {"refresh": login.data["refresh"]}, format="json")
        self.assertEqual(logout.status_code, 205)

        refresh = self.client.post(reverse("token_refresh"), {"refresh": login.data["refresh"]}, format="json")
        self.assertNotEqual(refresh.status_code, 200)

    def test_profile_patch_and_export(self):
        user, _ = self.authenticate()

        profile_response = self.client.patch(
            reverse("auth-profile"),
            {
                "base_currency": "EUR",
                "email_notifications": False,
                "low_balance_threshold": "250.00",
            },
            format="json",
        )
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data["base_currency"], "EUR")
        self.assertFalse(profile_response.data["email_notifications"])

        export_response = self.client.get(reverse("auth-export"))
        self.assertEqual(export_response.status_code, 200)
        self.assertEqual(export_response.data["user"]["username"], user.username)
        self.assertEqual(export_response.data["user"]["profile"]["base_currency"], "EUR")

    def test_two_factor_setup_verify_and_login(self):
        user, _ = self.authenticate(username="secure-user")

        setup_response = self.client.post(reverse("auth-2fa-setup"), format="json")
        self.assertEqual(setup_response.status_code, 200)
        self.assertIn("secret", setup_response.data)
        self.assertEqual(len(setup_response.data["backup_codes"]), 8)

        code = generate_totp_code(setup_response.data["secret"])
        verify_response = self.client.post(reverse("auth-2fa-verify"), {"code": code}, format="json")
        self.assertEqual(verify_response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.profile.two_factor_enabled)

        self.client.credentials()
        missing_otp_login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "secure-user", "password": "pass1234"},
            format="json",
        )
        self.assertEqual(missing_otp_login.status_code, 401)

        valid_login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "secure-user", "password": "pass1234", "otp_code": generate_totp_code(user.profile.otp_secret)},
            format="json",
        )
        self.assertEqual(valid_login.status_code, 200)

    def test_admin_can_create_and_manage_users(self):
        admin = User.objects.create_superuser(username="admin", email="admin@example.com", password="adminpass123")
        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "admin", "password": "adminpass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        manager_response = self.client.post(
            reverse("management-user-list"),
            {
                "username": "manager1",
                "email": "manager@example.com",
                "password": "managerpass123",
                "role": UserProfile.MANAGER,
                "base_currency": "USD",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(manager_response.status_code, 201)
        manager = User.objects.get(username="manager1")
        self.assertEqual(manager.profile.role, UserProfile.MANAGER)

        user_response = self.client.post(
            reverse("management-user-list"),
            {
                "username": "client1",
                "email": "client1@example.com",
                "password": "clientpass123",
                "role": UserProfile.USER,
                "base_currency": "EUR",
                "manager_ids": [manager.id],
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(user_response.status_code, 201)
        managed_user = User.objects.get(username="client1")
        self.assertTrue(ManagedUserAssignment.objects.filter(manager=manager, user=managed_user).exists())

        list_response = self.client.get(reverse("management-user-list"))
        self.assertEqual(list_response.status_code, 200)
        self.assertTrue(any(item["username"] == "client1" for item in list_response.data))

        settings_response = self.client.patch(
            reverse("system-settings"),
            {"allow_self_registration": False, "site_name": "PFM Control"},
            format="json",
        )
        self.assertEqual(settings_response.status_code, 200)
        self.assertFalse(SystemSetting.get_solo().allow_self_registration)
        self.assertEqual(SystemSetting.get_solo().site_name, "PFM Control")

    def test_manager_only_sees_assigned_users(self):
        manager = User.objects.create_user(username="manager2", email="manager2@example.com", password="managerpass123")
        manager.profile.role = UserProfile.MANAGER
        manager.profile.save(update_fields=["role", "updated_at"])

        assigned_user = User.objects.create_user(username="assigned", email="assigned@example.com", password="assigned123")
        unassigned_user = User.objects.create_user(username="freeuser", email="free@example.com", password="freeuser123")
        ManagedUserAssignment.objects.create(manager=manager, user=assigned_user)

        login = self.client.post(
            reverse("token_obtain_pair"),
            {"username": "manager2", "password": "managerpass123"},
            format="json",
        )
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        list_response = self.client.get(reverse("management-user-list"))
        self.assertEqual(list_response.status_code, 200)
        usernames = [item["username"] for item in list_response.data]
        self.assertIn("assigned", usernames)
        self.assertNotIn("freeuser", usernames)

        create_response = self.client.post(
            reverse("management-user-list"),
            {
                "username": "illegal-create",
                "email": "illegal@example.com",
                "password": "illegalpass123",
                "role": UserProfile.USER,
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, 403)

        report_response = self.client.get(reverse("management-user-report", kwargs={"user_id": assigned_user.id}))
        self.assertEqual(report_response.status_code, 200)

        forbidden_report = self.client.get(reverse("management-user-report", kwargs={"user_id": unassigned_user.id}))
        self.assertEqual(forbidden_report.status_code, 403)
