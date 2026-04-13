from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from core.utils import build_totp_uri, generate_backup_codes, generate_otp_secret, verify_totp_code
from transactions.services import build_dashboard_summary, convert_amount, create_default_categories_for_user

from .models import ManagedUserAssignment, SystemSetting, UserProfile


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        try:
            User.objects.get(email=value.lower())
        except User.DoesNotExist:
            # Don't reveal if email exists (security best practice)
            pass
        return value.lower()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    password_confirm = serializers.CharField(write_only=True, required=True, min_length=6)

    def validate(self, data):
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError("Passwords do not match.")
        return data


class UserProfileSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    can_manage_users = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = (
            "role",
            "role_display",
            "can_manage_users",
            "base_currency",
            "two_factor_enabled",
            "email_notifications",
            "push_notifications",
            "in_app_notifications",
            "low_balance_threshold",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("role", "role_display", "can_manage_users", "two_factor_enabled", "created_at", "updated_at")

    def get_can_manage_users(self, obj):
        return obj.can_manage_users


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(source="profile.role", read_only=True)
    role_display = serializers.CharField(source="profile.get_role_display", read_only=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "is_active", "is_staff", "role", "role_display", "profile")


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=6)
    base_currency = serializers.CharField(write_only=True, required=False, max_length=3)

    class Meta:
        model = User
        fields = ("username", "email", "password", "first_name", "last_name", "base_currency")

    def validate(self, attrs):
        if not SystemSetting.get_solo().allow_self_registration:
            raise serializers.ValidationError("Self-service registration is currently disabled.")
        return attrs

    def create(self, validated_data):
        base_currency = validated_data.pop("base_currency", None)
        system_setting = SystemSetting.get_solo()
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        create_default_categories_for_user(user)
        user.profile.role = UserProfile.USER
        user.profile.base_currency = (base_currency or system_setting.default_base_currency).upper()
        user.profile.save(update_fields=["role", "base_currency", "updated_at"])
        return user

    def to_representation(self, instance):
        data = UserSerializer(instance).data
        refresh = RefreshToken.for_user(instance)
        data.update({"access": str(refresh.access_token), "refresh": str(refresh)})
        return data


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    otp_code = serializers.CharField(write_only=True, required=False, allow_blank=True)
    backup_code = serializers.CharField(write_only=True, required=False, allow_blank=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["email"] = user.email
        token["base_currency"] = getattr(user.profile, "base_currency", "USD")
        token["role"] = getattr(user.profile, "role", UserProfile.USER)
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser
        return token

    def validate(self, attrs):
        otp_code = attrs.pop("otp_code", "")
        backup_code = attrs.pop("backup_code", "")
        data = super().validate(attrs)
        profile = getattr(self.user, "profile", None)
        if profile and profile.two_factor_enabled:
            valid_otp = verify_totp_code(profile.otp_secret, otp_code)
            valid_backup = profile.consume_backup_code(backup_code)
            if valid_backup:
                profile.save(update_fields=["backup_codes", "updated_at"])
            if not (valid_otp or valid_backup):
                raise AuthenticationFailed("A valid OTP code or backup code is required.")
        data["user"] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class TwoFactorSetupResponseSerializer(serializers.Serializer):
    secret = serializers.CharField()
    otpauth_uri = serializers.CharField()
    backup_codes = serializers.ListField(child=serializers.CharField())


class TwoFactorVerifySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)


class TwoFactorDisableSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6, required=False, allow_blank=True)
    backup_code = serializers.CharField(required=False, allow_blank=True)


class AccountDeletionSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    confirmation = serializers.CharField(write_only=True)

    def validate(self, attrs):
        request = self.context["request"]
        if attrs["confirmation"].strip().upper() != "DELETE":
            raise serializers.ValidationError({"confirmation": "Type DELETE to confirm account removal."})
        if not request.user.check_password(attrs["password"]):
            raise serializers.ValidationError({"password": "Password is incorrect."})
        return attrs


class ManagementUserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)
    role = serializers.CharField(source="profile.role", read_only=True)
    role_display = serializers.CharField(source="profile.get_role_display", read_only=True)
    manager_ids = serializers.SerializerMethodField()
    manager_names = serializers.SerializerMethodField()
    managed_user_ids = serializers.SerializerMethodField()
    assigned_user_count = serializers.SerializerMethodField()
    financial_snapshot = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "last_login",
            "role",
            "role_display",
            "profile",
            "manager_ids",
            "manager_names",
            "managed_user_ids",
            "assigned_user_count",
            "financial_snapshot",
        )

    def get_manager_ids(self, obj):
        return list(obj.manager_assignments.values_list("manager_id", flat=True))

    def get_manager_names(self, obj):
        return [item.manager.username for item in obj.manager_assignments.select_related("manager")]

    def get_managed_user_ids(self, obj):
        return list(obj.managed_user_assignments.values_list("user_id", flat=True))

    def get_assigned_user_count(self, obj):
        return obj.managed_user_assignments.count()

    def get_financial_snapshot(self, obj):
        summary = build_dashboard_summary(obj)
        system_currency = SystemSetting.get_solo().default_base_currency
        source_currency = summary["base_currency"]
        return {
            "currency": system_currency,
            "source_currency": source_currency,
            "net_worth": convert_amount(summary["net_worth"], source_currency, system_currency),
            "income_total": convert_amount(summary["income_total"], source_currency, system_currency),
            "expense_total": convert_amount(summary["expense_total"], source_currency, system_currency),
            "budget_alerts": summary["budget_alerts"],
            "accounts_count": len(summary["accounts"]),
            "goals_count": len(summary["goals"]),
        }


class ManagementUserWriteSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=6, allow_blank=True)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)
    base_currency = serializers.CharField(required=False, max_length=3)
    manager_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True)
    managed_user_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, write_only=True)

    class Meta:
        model = User
        fields = (
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "is_active",
            "role",
            "base_currency",
            "manager_ids",
            "managed_user_ids",
        )

    def validate_manager_ids(self, value):
        managers = User.objects.filter(id__in=value, profile__role=UserProfile.MANAGER)
        if managers.count() != len(set(value)):
            raise serializers.ValidationError("Every manager assignment must reference a valid manager user.")
        return list(dict.fromkeys(value))

    def validate_managed_user_ids(self, value):
        users = User.objects.filter(id__in=value, profile__role=UserProfile.USER)
        if users.count() != len(set(value)):
            raise serializers.ValidationError("Managed user assignments can only include normal users.")
        return list(dict.fromkeys(value))

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        if not password:
            raise serializers.ValidationError({"password": "Password is required when creating a new user."})
        role = validated_data.pop("role", UserProfile.USER)
        base_currency = validated_data.pop("base_currency", SystemSetting.get_solo().default_base_currency)
        manager_ids = validated_data.pop("manager_ids", [])
        managed_user_ids = validated_data.pop("managed_user_ids", [])

        user = User.objects.create_user(password=password, **validated_data)
        self._sync_user_access_flags(user, role)
        user.save(update_fields=["is_staff", "is_superuser"])
        user.profile.role = role
        user.profile.base_currency = base_currency.upper()
        user.profile.save(update_fields=["role", "base_currency", "updated_at"])
        create_default_categories_for_user(user)
        self._sync_assignments(user, manager_ids=manager_ids, managed_user_ids=managed_user_ids)
        return user

    def update(self, instance, validated_data):
        previous_role = instance.profile.role
        password = validated_data.pop("password", None)
        role = validated_data.pop("role", instance.profile.role)
        base_currency = validated_data.pop("base_currency", instance.profile.base_currency)
        manager_ids = validated_data.pop("manager_ids", None)
        managed_user_ids = validated_data.pop("managed_user_ids", None)

        for field, value in validated_data.items():
            setattr(instance, field, value)

        if password:
            instance.set_password(password)

        self._sync_user_access_flags(instance, role)
        instance.save()

        instance.profile.role = role
        instance.profile.base_currency = base_currency.upper()
        instance.profile.save(update_fields=["role", "base_currency", "updated_at"])
        if previous_role != role:
            ManagedUserAssignment.objects.filter(user=instance).delete()
            ManagedUserAssignment.objects.filter(manager=instance).delete()
        self._sync_assignments(instance, manager_ids=manager_ids, managed_user_ids=managed_user_ids)
        return instance

    def _sync_user_access_flags(self, user, role):
        if role == UserProfile.ADMINISTRATOR:
            user.is_staff = True
            user.is_superuser = True
        else:
            user.is_staff = False
            user.is_superuser = False

    def _sync_assignments(self, user, manager_ids=None, managed_user_ids=None):
        actor = self.context["request"].user
        if user.profile.role == UserProfile.USER:
            if manager_ids is None:
                return
            ManagedUserAssignment.objects.filter(user=user).exclude(manager_id__in=manager_ids).delete()
            existing = set(ManagedUserAssignment.objects.filter(user=user).values_list("manager_id", flat=True))
            for manager_id in manager_ids:
                if manager_id not in existing:
                    ManagedUserAssignment.objects.create(manager_id=manager_id, user=user, assigned_by=actor)
            return

        if user.profile.role == UserProfile.MANAGER:
            if managed_user_ids is None:
                return
            ManagedUserAssignment.objects.filter(manager=user).exclude(user_id__in=managed_user_ids).delete()
            existing = set(ManagedUserAssignment.objects.filter(manager=user).values_list("user_id", flat=True))
            for user_id in managed_user_ids:
                if user_id not in existing:
                    ManagedUserAssignment.objects.create(manager=user, user_id=user_id, assigned_by=actor)
            return

        ManagedUserAssignment.objects.filter(user=user).delete()
        ManagedUserAssignment.objects.filter(manager=user).delete()


class SystemSettingSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source="updated_by.username", read_only=True)

    class Meta:
        model = SystemSetting
        fields = (
            "site_name",
            "allow_self_registration",
            "default_base_currency",
            "support_email",
            "maintenance_mode",
            "updated_by",
            "updated_by_username",
            "updated_at",
        )
        read_only_fields = ("updated_by", "updated_by_username", "updated_at")
