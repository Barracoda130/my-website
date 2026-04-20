from django.contrib import admin

from .models import AllowanceEntry, FamilyMember, Household, SpendEntry


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("name", "owner", "created_at")
    search_fields = ("name", "owner__username", "owner__email")


@admin.register(FamilyMember)
class FamilyMemberAdmin(admin.ModelAdmin):
    list_display = ("name", "household", "role", "is_active", "updated_at")
    list_filter = ("role", "is_active")
    search_fields = ("name", "household__name", "household__owner__username")


@admin.register(AllowanceEntry)
class AllowanceEntryAdmin(admin.ModelAdmin):
    list_display = ("member", "amount", "received_at", "household", "created_by")
    list_filter = ("received_at",)
    search_fields = ("member__name", "household__name", "created_by__username")
    date_hierarchy = "received_at"


@admin.register(SpendEntry)
class SpendEntryAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "member",
        "kind",
        "payer",
        "amount",
        "spent_at",
        "manual_significant",
    )
    list_filter = ("kind", "payer", "manual_significant", "spent_at")
    search_fields = ("title", "member__name", "household__name")
    date_hierarchy = "spent_at"
