from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import UserProfile, InviteToken, UserModuleAccess, UserGroup


# ─── Inline: show UserProfile inside the User admin page ─────────────────────
class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = 'Profile'


# ─── Inline: show module access inside the User admin page ───────────────────
class UserModuleAccessInline(admin.TabularInline):
    model = UserModuleAccess
    fk_name = 'user'  # Use the 'user' FK (not 'granted_by') to link to the parent User
    extra = 1  # Show 1 empty row for adding new access
    readonly_fields = ['granted_at']


# ─── Extend the built-in User admin to include our inlines ───────────────────
class UserAdmin(BaseUserAdmin):
    inlines = [UserProfileInline, UserModuleAccessInline]


# Re-register User with our extended admin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


# ─── InviteToken admin ────────────────────────────────────────────────────────
@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display = ['token', 'created_by', 'used_by', 'created_at', 'expires_at', 'is_used']
    list_filter = ['is_used']
    readonly_fields = ['token', 'created_at', 'used_by', 'is_used']

    def save_model(self, request, obj, form, change):
        # Automatically set created_by to the currently logged-in admin
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


# ─── UserModuleAccess admin ───────────────────────────────────────────────────
@admin.register(UserModuleAccess)
class UserModuleAccessAdmin(admin.ModelAdmin):
    list_display = ['user', 'module', 'granted_by', 'granted_at']
    list_filter = ['module']
    readonly_fields = ['granted_at']

    def save_model(self, request, obj, form, change):
        # Automatically set granted_by to the currently logged-in admin
        if not obj.pk:
            obj.granted_by = request.user
        super().save_model(request, obj, form, change)


# ─── UserGroup admin ──────────────────────────────────────────────────────────
@admin.register(UserGroup)
class UserGroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'created_at', 'member_count']
    readonly_fields = ['created_at']
    filter_horizontal = ['members']  # Nice dual-list widget for adding members

    @admin.display(description='Members')
    def member_count(self, obj):
        return obj.members.count()

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
