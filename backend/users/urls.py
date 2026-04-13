from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    DeleteAccountView,
    LoginView,
    LogoutView,
    ManagementUserDetailView,
    ManagementUserListCreateView,
    ManagementUserReportView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    SystemSettingView,
    TwoFactorDisableView,
    TwoFactorSetupView,
    TwoFactorVerifyView,
    UserExportView,
    UserProfileView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("profile/", UserProfileView.as_view(), name="auth-profile"),
    path("2fa/setup/", TwoFactorSetupView.as_view(), name="auth-2fa-setup"),
    path("2fa/verify/", TwoFactorVerifyView.as_view(), name="auth-2fa-verify"),
    path("2fa/disable/", TwoFactorDisableView.as_view(), name="auth-2fa-disable"),
    path("export/", UserExportView.as_view(), name="auth-export"),
    path("delete/", DeleteAccountView.as_view(), name="auth-delete"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="auth-password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="auth-password-reset-confirm"),
    path("management/users/", ManagementUserListCreateView.as_view(), name="management-user-list"),
    path("management/users/<int:user_id>/", ManagementUserDetailView.as_view(), name="management-user-detail"),
    path("management/users/<int:user_id>/report/", ManagementUserReportView.as_view(), name="management-user-report"),
    path("system-settings/", SystemSettingView.as_view(), name="system-settings"),
]
