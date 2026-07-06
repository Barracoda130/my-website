from django.conf import settings
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from django.utils.html import format_html

from .models import UserProfile, InviteToken, InviteTokenModuleAccess, UserModuleAccess, UserGroup


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
class InviteTokenModuleAccessInline(admin.TabularInline):
    model = InviteTokenModuleAccess
    extra = 1
    fields = ['module']


@admin.register(InviteToken)
class InviteTokenAdmin(admin.ModelAdmin):
    list_display = [
        'token',
        'created_by',
        'used_by',
        'created_at',
        'expires_at',
        'is_used',
        'preset_modules',
        'invite_link_column',
    ]
    list_filter = ['is_used']
    readonly_fields = ['token', 'created_at', 'used_by', 'is_used', 'registration_link']
    inlines = [InviteTokenModuleAccessInline]

    @admin.display(description='Preset modules')
    def preset_modules(self, obj):
        modules = [preset.get_module_display() for preset in obj.module_presets.all()]
        return ', '.join(modules) if modules else 'No modules'

    @admin.display(description='Registration link')
    def registration_link(self, obj):
        if not obj.pk:
            return 'Save this invite first to generate a registration link.'
        return self.build_registration_link(obj)

    @admin.display(description='Invite link')
    def invite_link_column(self, obj):
        link = self.build_registration_link(obj)
        return format_html('<a href="{}" target="_blank" rel="noopener noreferrer">Open link</a>', link)

    def build_registration_link(self, obj):
        frontend_base_url = getattr(settings, 'FRONTEND_BASE_URL', 'http://localhost:5173').rstrip('/')
        return f'{frontend_base_url}/register?invite={obj.token}'

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
