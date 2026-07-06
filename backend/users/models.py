import uuid
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class UserProfile(models.Model):
    """Extended profile for each user."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Profile of {self.user.username}"


# ─── Module Registry ──────────────────────────────────────────────────────────
# Add new module slugs here when you create new modules.
AVAILABLE_MODULES = [
    ('budget_tracker', 'Budget Tracker'),
    ('family_finances', 'Family Finances'),
]

MODULE_CHOICES = AVAILABLE_MODULES


class InviteToken(models.Model):
    """Single-use invite tokens for registration."""
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_invites'
    )
    used_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='used_invite'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    is_used = models.BooleanField(default=False)

    def is_valid(self):
        if self.is_used:
            return False
        if self.expires_at and timezone.now() > self.expires_at:
            return False
        return True

    def __str__(self):
        status = "used" if self.is_used else "active"
        return f"Invite {str(self.token)[:8]}... ({status})"


class InviteTokenModuleAccess(models.Model):
    """Module access that should be granted when an invite token is used."""
    invite = models.ForeignKey(InviteToken, on_delete=models.CASCADE, related_name='module_presets')
    module = models.CharField(max_length=64, choices=MODULE_CHOICES)

    class Meta:
        unique_together = ('invite', 'module')
        verbose_name = 'Invite Module Access'
        verbose_name_plural = 'Invite Module Access'

    def __str__(self):
        return f"{self.invite} grants {self.module}"


def has_module_access(self, module_name):
    """Return whether this user has been granted access to a module slug."""
    if not self.is_authenticated:
        return False
    return self.module_access.filter(module=module_name).exists()


User.add_to_class('has_module_access', has_module_access)


class UserModuleAccess(models.Model):
    """Tracks which modules a user has been granted access to."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='module_access')
    module = models.CharField(max_length=64, choices=MODULE_CHOICES)
    granted_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='granted_access'
    )
    granted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Prevents the same module being granted to the same user twice
        unique_together = ('user', 'module')
        verbose_name = 'User Module Access'
        verbose_name_plural = 'User Module Access'

    def __str__(self):
        return f"{self.user.username} → {self.module}"


class UserGroup(models.Model):
    """
    A named group of users who share access to data in certain modules.
    Used for shared/collaborative modules (e.g. Family Finances).
    """
    name = models.CharField(max_length=128)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='created_groups'
    )
    members = models.ManyToManyField(User, related_name='user_groups', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
