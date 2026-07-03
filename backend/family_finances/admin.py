from django.contrib import admin

from .models import Child, Family, FamilyMembership, FamilyTransaction, TransactionChildSplit


class ChildInline(admin.TabularInline):
    model = Child
    extra = 0
    fields = ['name', 'date_of_birth', 'active', 'notes']


class FamilyMembershipInline(admin.TabularInline):
    model = FamilyMembership
    extra = 0
    fields = ['user', 'role']


class TransactionChildSplitInline(admin.TabularInline):
    model = TransactionChildSplit
    extra = 0
    fields = ['child', 'amount', 'percentage']


@admin.register(Family)
class FamilyAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_by', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [FamilyMembershipInline, ChildInline]


@admin.register(FamilyMembership)
class FamilyMembershipAdmin(admin.ModelAdmin):
    list_display = ['family', 'user', 'role', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['family__name', 'family__code', 'user__username']


@admin.register(Child)
class ChildAdmin(admin.ModelAdmin):
    list_display = ['name', 'family', 'active', 'date_of_birth', 'created_at']
    list_filter = ['active', 'created_at']
    search_fields = ['name', 'family__name', 'family__code']


@admin.register(FamilyTransaction)
class FamilyTransactionAdmin(admin.ModelAdmin):
    list_display = ['date', 'title', 'family', 'amount', 'type', 'category', 'counts_toward_fairness', 'recurring']
    list_filter = ['type', 'category', 'paid_by', 'counts_toward_fairness', 'is_large_expense', 'recurring']
    search_fields = ['title', 'family__name', 'family__code', 'notes']
    readonly_fields = ['created_at', 'updated_at']
    inlines = [TransactionChildSplitInline]


@admin.register(TransactionChildSplit)
class TransactionChildSplitAdmin(admin.ModelAdmin):
    list_display = ['transaction', 'child', 'amount', 'percentage']
    search_fields = ['transaction__title', 'child__name', 'transaction__family__name']
