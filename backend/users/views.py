from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from core.permissions import can_manage_users, is_administrator
from core.utils import build_totp_uri, generate_backup_codes, generate_otp_secret, verify_totp_code
from transactions.models import Notification
from transactions.services import create_audit_log, create_notification, export_user_financial_data

from .models import SystemSetting, UserProfile
from .serializers import (
    AccountDeletionSerializer,
    CustomTokenObtainPairSerializer,
    LogoutSerializer,
    ManagementUserSerializer,
    ManagementUserWriteSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    SystemSettingSerializer,
    TwoFactorDisableSerializer,
    TwoFactorVerifySerializer,
    UserProfileSerializer,
    UserSerializer,
)


def get_accessible_users_for_actor(actor):
    queryset = User.objects.select_related("profile").prefetch_related("manager_assignments__manager", "managed_user_assignments__user")
    if is_administrator(actor):
        return queryset.order_by("username")
    return queryset.filter(manager_assignments__manager=actor, profile__role=UserProfile.USER).distinct().order_by("username")


def get_accessible_user_or_403(actor, user_id):
    target_user = get_object_or_404(User.objects.select_related("profile"), pk=user_id)
    if is_administrator(actor):
        return target_user
    if not can_manage_users(actor):
        raise PermissionDenied("You do not have permission to manage users.")
    is_assigned = target_user.manager_assignments.filter(manager=actor).exists()
    if getattr(target_user.profile, "role", None) == UserProfile.USER and is_assigned:
        return target_user
    raise PermissionDenied("You do not have permission to access this user.")


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def perform_create(self, serializer):
        user = serializer.save()
        create_audit_log(user, "auth.register", "User registered", resource_type="user", resource_id=user.id)


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [permissions.AllowAny]


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = RefreshToken(serializer.validated_data["refresh"])
            token.blacklist()
        except TokenError:
            return Response({"detail": "Refresh token is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserProfileSerializer(request.user.profile).data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user.profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        create_audit_log(request.user, "profile.update", "Updated user profile", resource_type="user_profile", resource_id=request.user.profile.id)
        return Response(serializer.data)


class TwoFactorSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        secret = generate_otp_secret()
        backup_codes = generate_backup_codes()
        profile.pending_otp_secret = secret
        profile.backup_codes = backup_codes
        profile.save(update_fields=["pending_otp_secret", "backup_codes", "updated_at"])
        create_audit_log(request.user, "security.2fa_setup_started", "Started 2FA setup", resource_type="user_profile", resource_id=profile.id)
        return Response(
            {
                "secret": secret,
                "otpauth_uri": build_totp_uri(secret, request.user.username),
                "backup_codes": backup_codes,
            }
        )


class TwoFactorVerifyView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = request.user.profile
        if not profile.pending_otp_secret:
            return Response({"detail": "Start 2FA setup first."}, status=status.HTTP_400_BAD_REQUEST)
        if not verify_totp_code(profile.pending_otp_secret, serializer.validated_data["code"]):
            return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)

        profile.otp_secret = profile.pending_otp_secret
        profile.pending_otp_secret = ""
        profile.two_factor_enabled = True
        profile.ensure_backup_codes()
        profile.save(update_fields=["otp_secret", "pending_otp_secret", "two_factor_enabled", "backup_codes", "updated_at"])
        create_notification(
            request.user,
            Notification.SECURITY,
            "Two-factor authentication enabled",
            "Your account now requires an OTP code or backup code at login.",
            severity=Notification.SUCCESS,
        )
        create_audit_log(request.user, "security.2fa_enabled", "Enabled 2FA", resource_type="user_profile", resource_id=profile.id)
        return Response(UserProfileSerializer(profile).data)


class TwoFactorDisableView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TwoFactorDisableSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = request.user.profile
        valid_otp = verify_totp_code(profile.otp_secret, serializer.validated_data.get("code"))
        valid_backup = profile.consume_backup_code(serializer.validated_data.get("backup_code"))
        if valid_backup:
            profile.save(update_fields=["backup_codes", "updated_at"])
        if profile.two_factor_enabled and not (valid_otp or valid_backup):
            return Response({"detail": "A valid OTP code or backup code is required."}, status=status.HTTP_400_BAD_REQUEST)

        profile.two_factor_enabled = False
        profile.otp_secret = ""
        profile.pending_otp_secret = ""
        profile.save(update_fields=["two_factor_enabled", "otp_secret", "pending_otp_secret", "updated_at"])
        create_notification(
            request.user,
            Notification.SECURITY,
            "Two-factor authentication disabled",
            "2FA has been disabled for your account.",
            severity=Notification.WARNING,
        )
        create_audit_log(request.user, "security.2fa_disabled", "Disabled 2FA", resource_type="user_profile", resource_id=profile.id)
        return Response(UserProfileSerializer(profile).data)


class UserExportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        create_audit_log(request.user, "gdpr.export", "Exported user data", resource_type="user", resource_id=request.user.id)
        return Response(export_user_financial_data(request.user))


class DeleteAccountView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = AccountDeletionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = request.user
        username = user.username
        create_audit_log(user, "gdpr.delete_requested", "User requested account deletion", resource_type="user", resource_id=user.id)
        user.delete()
        return Response({"detail": f"Account {username} deleted."}, status=status.HTTP_200_OK)


class ManagementUserListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not can_manage_users(request.user):
            raise PermissionDenied("You do not have permission to manage users.")
        serializer = ManagementUserSerializer(get_accessible_users_for_actor(request.user), many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request):
        if not is_administrator(request.user):
            raise PermissionDenied("Only administrators can create users.")
        serializer = ManagementUserWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        create_audit_log(
            request.user,
            "management.user_create",
            f"Created user {user.username} with role {user.profile.role}",
            resource_type="user",
            resource_id=user.id,
        )
        return Response(ManagementUserSerializer(user, context={"request": request}).data, status=status.HTTP_201_CREATED)


class ManagementUserDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        target_user = get_accessible_user_or_403(request.user, user_id)
        return Response(ManagementUserSerializer(target_user, context={"request": request}).data)

    def patch(self, request, user_id):
        if not is_administrator(request.user):
            raise PermissionDenied("Only administrators can update users.")
        target_user = get_accessible_user_or_403(request.user, user_id)
        if target_user == request.user and "role" in request.data and request.data["role"] != target_user.profile.role:
            raise PermissionDenied("Administrators cannot change their own role from this screen.")
        serializer = ManagementUserWriteSerializer(target_user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        updated_user = serializer.save()
        create_audit_log(
            request.user,
            "management.user_update",
            f"Updated user {updated_user.username}",
            resource_type="user",
            resource_id=updated_user.id,
        )
        return Response(ManagementUserSerializer(updated_user, context={"request": request}).data)

    def delete(self, request, user_id):
        if not is_administrator(request.user):
            raise PermissionDenied("Only administrators can delete users.")
        target_user = get_accessible_user_or_403(request.user, user_id)
        if target_user == request.user:
            raise PermissionDenied("Administrators cannot delete themselves from this screen.")
        username = target_user.username
        target_id = target_user.id
        target_user.delete()
        create_audit_log(
            request.user,
            "management.user_delete",
            f"Deleted user {username}",
            resource_type="user",
            resource_id=target_id,
        )
        return Response({"detail": f"User {username} deleted."}, status=status.HTTP_200_OK)


class ManagementUserReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        if not can_manage_users(request.user):
            raise PermissionDenied("You do not have permission to view user reports.")
        target_user = get_accessible_user_or_403(request.user, user_id)
        create_audit_log(
            request.user,
            "management.user_report",
            f"Viewed financial report for {target_user.username}",
            resource_type="user",
            resource_id=target_user.id,
        )
        payload = export_user_financial_data(target_user)
        payload["accessed_by"] = {
            "id": request.user.id,
            "username": request.user.username,
            "role": getattr(request.user.profile, "role", UserProfile.USER),
        }
        return Response(payload)


class SystemSettingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_administrator(request.user):
            raise PermissionDenied("Only administrators can view system settings.")
        return Response(SystemSettingSerializer(SystemSetting.get_solo()).data)

    def patch(self, request):
        if not is_administrator(request.user):
            raise PermissionDenied("Only administrators can update system settings.")
        setting = SystemSetting.get_solo()
        serializer = SystemSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(updated_by=request.user)
        create_audit_log(
            request.user,
            "system.settings_update",
            "Updated system settings",
            resource_type="system_setting",
            resource_id=setting.id,
        )
        return Response(SystemSettingSerializer(setting).data)


class PasswordResetRequestView(APIView):
    """Send password reset email with token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        try:
            user = User.objects.get(email=email)
            # Generate reset token using JWT
            token = RefreshToken.for_user(user)
            reset_token = str(token.access_token)

            # Build reset URL
            frontend_url = settings.FRONTEND_URL or "http://localhost:5173"
            reset_url = f"{frontend_url}/reset-password?token={reset_token}"

            # Send email
            send_mail(
                subject="Password Reset Request",
                message=f"Click the link to reset your password: {reset_url}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )

            create_audit_log(
                user,
                "auth.password_reset_request",
                "Password reset requested",
                resource_type="user",
                resource_id=user.id,
            )
        except User.DoesNotExist:
            # Don't reveal if user exists
            pass

        return Response(
            {"detail": "If an account exists with this email, you will receive a password reset link."},
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["password"]

        try:
            # Decode token to get user
            from rest_framework_simplejwt.tokens import AccessToken
            access_token = AccessToken(token)
            user_id = access_token["user_id"]
            user = User.objects.get(id=user_id)

            # Set new password
            user.set_password(new_password)
            user.save()

            create_audit_log(
                user,
                "auth.password_reset_complete",
                "Password reset completed",
                resource_type="user",
                resource_id=user.id,
            )

            return Response(
                {"detail": "Password has been reset successfully."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"detail": "Invalid or expired token."},
                status=status.HTTP_400_BAD_REQUEST,
            )
