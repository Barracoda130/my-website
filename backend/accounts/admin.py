from django.contrib import admin

from .models import UserSectionAccess


@admin.register(UserSectionAccess)
class UserSectionAccessAdmin(admin.ModelAdmin):
	list_display = (
		"user",
		"can_access_expenses",
		"can_access_family_finances",
		"updated_at",
	)
	list_filter = ("can_access_expenses", "can_access_family_finances")
	search_fields = ("user__username", "user__email")
