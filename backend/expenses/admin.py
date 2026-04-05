from django.contrib import admin

from .models import ExpenseCategory, ExpenseEntry


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "user", "created_at")
    search_fields = ("name", "user__username")


@admin.register(ExpenseEntry)
class ExpenseEntryAdmin(admin.ModelAdmin):
    list_display = ("id", "title", "user", "amount", "spent_at", "category")
    list_filter = ("spent_at",)
    search_fields = ("title", "user__username", "category__name")
