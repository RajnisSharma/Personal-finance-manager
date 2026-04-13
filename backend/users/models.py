from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.db import models

from core.utils import generate_backup_codes


class UserProfile(models.Model):
    ADMINISTRATOR = "administrator"
    USER = "user"
    MANAGER = "manager"

    ROLE_CHOICES = (
        (ADMINISTRATOR, "Administrator"),
        (USER, "Normal User"),
        (MANAGER, "Account / Finance Manager"),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default=USER)
    base_currency = models.CharField(max_length=3, default="USD")
    two_factor_enabled = models.BooleanField(default=False)
    otp_secret = models.CharField(max_length=64, blank=True)
    pending_otp_secret = models.CharField(max_length=64, blank=True)
    backup_codes = models.JSONField(default=list, blank=True)
    email_notifications = models.BooleanField(default=True)
    push_notifications = models.BooleanField(default=False)
    in_app_notifications = models.BooleanField(default=True)
    low_balance_threshold = models.DecimalField(max_digits=12, decimal_places=2, default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def ensure_backup_codes(self):
        if not self.backup_codes:
            self.backup_codes = generate_backup_codes()
        return self.backup_codes

    def consume_backup_code(self, code):
        normalized = (code or "").strip().upper()
        if normalized and normalized in self.backup_codes:
            self.backup_codes = [item for item in self.backup_codes if item != normalized]
            return True
        return False

    @property
    def is_administrator(self):
        return self.role == self.ADMINISTRATOR or self.user.is_superuser

    @property
    def is_manager(self):
        return self.role == self.MANAGER

    @property
    def can_manage_users(self):
        return self.is_administrator or self.is_manager

    def __str__(self):
        return f"Profile for {self.user.username}"


class ManagedUserAssignment(models.Model):
    manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name="managed_user_assignments")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="manager_assignments")
    assigned_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_manager_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["manager__username", "user__username"]
        unique_together = ("manager", "user")

    def clean(self):
        if self.manager_id == self.user_id:
            raise ValidationError("A manager cannot be assigned to themselves.")
        if getattr(self.manager.profile, "role", None) != UserProfile.MANAGER:
            raise ValidationError({"manager": "Assigned manager must have the manager role."})
        if getattr(self.user.profile, "role", None) != UserProfile.USER:
            raise ValidationError({"user": "Only normal users can be assigned to a manager."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.manager.username} manages {self.user.username}"


class SystemSetting(models.Model):
    site_name = models.CharField(max_length=120, default="Personal Finance Manager")
    allow_self_registration = models.BooleanField(default=True)
    default_base_currency = models.CharField(max_length=3, default="USD")
    support_email = models.EmailField(blank=True)
    maintenance_mode = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_system_settings",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "system settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        self.default_base_currency = (self.default_base_currency or "USD").upper()
        super().save(*args, **kwargs)

    @classmethod
    def get_solo(cls):
        setting, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                "site_name": "Personal Finance Manager",
                "allow_self_registration": True,
                "default_base_currency": "USD",
                "support_email": "",
                "maintenance_mode": False,
            },
        )
        return setting

    def __str__(self):
        return self.site_name
