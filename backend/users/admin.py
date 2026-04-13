from django.contrib import admin

from .models import ManagedUserAssignment, SystemSetting, UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "base_currency", "two_factor_enabled", "email_notifications", "in_app_notifications")
    search_fields = ("user__username", "user__email")
    list_filter = ("role", "two_factor_enabled", "email_notifications")


@admin.register(ManagedUserAssignment)
class ManagedUserAssignmentAdmin(admin.ModelAdmin):
    list_display = ("manager", "user", "assigned_by", "created_at")
    search_fields = ("manager__username", "user__username", "assigned_by__username")


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ("site_name", "allow_self_registration", "default_base_currency", "maintenance_mode", "updated_at")
