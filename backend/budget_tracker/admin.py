from django.contrib import admin

from .models import Account, Budget, Category, CategoryGroup, RecurringItem, Transaction


@admin.register(CategoryGroup)
class CategoryGroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'type', 'sort_order', 'is_archived')
    list_filter = ('type', 'is_archived')
    search_fields = ('name', 'user__username')


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'group', 'type', 'is_archived')
    list_filter = ('type', 'is_archived', 'group')
    search_fields = ('name', 'user__username')


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'type', 'opening_balance', 'is_archived')
    list_filter = ('type', 'is_archived')
    search_fields = ('name', 'user__username')


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('date', 'description', 'user', 'account', 'category', 'type', 'amount')
    list_filter = ('type', 'date', 'category')
    search_fields = ('description', 'payee', 'user__username')
    date_hierarchy = 'date'


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('month', 'user', 'category', 'amount')
    list_filter = ('month', 'category')
    search_fields = ('category__name', 'user__username')


@admin.register(RecurringItem)
class RecurringItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'type', 'frequency', 'amount', 'next_due_date', 'is_active')
    list_filter = ('type', 'frequency', 'is_active')
    search_fields = ('name', 'user__username')
    date_hierarchy = 'next_due_date'
