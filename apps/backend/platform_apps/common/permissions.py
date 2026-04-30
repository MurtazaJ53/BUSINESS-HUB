from __future__ import annotations

from rest_framework.permissions import BasePermission


class IsPlatformAdminUser(BasePermission):
    message = "Platform admin access is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_platform_admin)
