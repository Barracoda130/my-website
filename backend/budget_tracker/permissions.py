from rest_framework.permissions import IsAuthenticated


class HasBudgetTrackerAccess(IsAuthenticated):
    """Allow access only to authenticated users granted the Budget Tracker module."""

    message = 'You do not have access to the Budget Tracker module.'

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.has_module_access('budget_tracker')