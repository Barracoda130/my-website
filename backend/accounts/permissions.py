from rest_framework import permissions

from .models import UserSectionAccess, user_has_section_access


class SectionAccessPermission(permissions.BasePermission):
    required_section: str | None = None

    def has_permission(self, request, view):
        section = self.required_section
        if section is None:
            return False
        if not request.user or not request.user.is_authenticated:
            return False
        return user_has_section_access(request.user, section)


class ExpensesSectionPermission(SectionAccessPermission):
    required_section = UserSectionAccess.SECTION_EXPENSES


class FamilyFinancesSectionPermission(SectionAccessPermission):
    required_section = UserSectionAccess.SECTION_FAMILY_FINANCES
