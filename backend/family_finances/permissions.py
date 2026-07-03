from rest_framework.permissions import IsAuthenticated


class HasFamilyFinancesAccess(IsAuthenticated):
    """Allow access only to authenticated users granted the Family Finances module."""

    message = 'You do not have access to the Family Finances module.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.has_module_access('family_finances')