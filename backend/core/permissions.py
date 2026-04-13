from rest_framework import permissions

from users.models import UserProfile


def get_user_role(user):
    if not getattr(user, "is_authenticated", False):
        return None
    if user.is_superuser:
        return UserProfile.ADMINISTRATOR
    return getattr(getattr(user, "profile", None), "role", UserProfile.USER)


def is_administrator(user):
    return get_user_role(user) == UserProfile.ADMINISTRATOR


def is_manager(user):
    return get_user_role(user) == UserProfile.MANAGER


def can_manage_users(user):
    return is_administrator(user) or is_manager(user)


def get_accessible_user_ids(user):
    """Return None for all users, a list of user ids for a manager, or a single-item list for normal users."""
    if not user or not getattr(user, "is_authenticated", False):
        return []
    if is_administrator(user):
        return None
    if is_manager(user):
        from users.models import ManagedUserAssignment

        assigned_user_ids = list(ManagedUserAssignment.objects.filter(manager=user).values_list("user_id", flat=True))
        return sorted({*assigned_user_ids, user.id})
    return [user.id]


def can_access_user(user, target_user):
    if not user or not target_user:
        return False
    if is_administrator(user):
        return True
    if user == target_user:
        return True
    if is_manager(user):
        from users.models import ManagedUserAssignment

        return ManagedUserAssignment.objects.filter(manager=user, user=target_user).exists()
    return False


class IsAdministrator(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_administrator(request.user))


class IsAdministratorOrManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and can_manage_users(request.user))


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Object-level permission to only allow owners of an object to edit or delete it.
    Assumes the model instance has an `user` attribute or `account.user`.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to authenticated users
        if request.method in permissions.SAFE_METHODS:
            return self._get_user(obj) == request.user
        # Write permissions only to owner
        return self._get_user(obj) == request.user

    def _get_user(self, obj):
        if hasattr(obj, "user"):
            return obj.user
        elif hasattr(obj, "account"):
            return obj.account.user
        return None


class IsOwnerOrAssignedManagerOrAdmin(permissions.BasePermission):
    """Object-level permission usable on financial records.

    - Administrator: full access
    - Manager: assigned users and self
    - Normal User: owner-only
    """

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False

        owner = self._get_user(obj)
        if owner is None:
            return False

        if is_administrator(request.user):
            return True

        if owner == request.user:
            return True

        if is_manager(request.user):
            from users.models import ManagedUserAssignment

            return ManagedUserAssignment.objects.filter(manager=request.user, user=owner).exists()

        return False

    def _get_user(self, obj):
        if hasattr(obj, "user"):
            return obj.user
        elif hasattr(obj, "account"):
            return obj.account.user
        return None
