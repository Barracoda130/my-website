from decimal import Decimal
import uuid

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class Household(models.Model):
    owner = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="family_household",
    )
    name = models.CharField(max_length=120, default="My Household")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class FamilyMember(models.Model):
    class Role(models.TextChoices):
        PARENT = "parent", "Parent"
        CHILD = "child", "Child"

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="members",
    )
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=10, choices=Role.choices)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["household", "name"],
                name="uniq_family_member_name_per_household",
            )
        ]

    def __str__(self) -> str:
        return self.name


class AllowanceEntry(models.Model):
    class RecurringInterval(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="allowance_entries",
    )
    member = models.ForeignKey(
        FamilyMember,
        on_delete=models.CASCADE,
        related_name="allowances",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    received_at = models.DateField()
    is_recurring = models.BooleanField(default=False)
    recurring_interval = models.CharField(
        max_length=10,
        choices=RecurringInterval.choices,
        blank=True,
    )
    recurring_end_date = models.DateField(null=True, blank=True)
    recurring_payment_count = models.PositiveIntegerField(null=True, blank=True)
    recurrence_group_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    recurrence_sequence = models.PositiveIntegerField(default=1)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="family_allowances_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-received_at", "-id"]
        indexes = [
            models.Index(fields=["member", "received_at"]),
            models.Index(fields=["household", "received_at"]),
            models.Index(fields=["household", "recurrence_group_id"]),
        ]

    def __str__(self) -> str:
        return f"{self.member.name}: {self.amount}"


class SpendEntry(models.Model):
    class Kind(models.TextChoices):
        SIGNIFICANT_PURCHASE = "significant_purchase", "Significant purchase"
        HOLIDAY = "holiday", "Holiday"

    class Payer(models.TextChoices):
        PARENT = "parent", "Parent"
        CHILD = "child", "Child"

    household = models.ForeignKey(
        Household,
        on_delete=models.CASCADE,
        related_name="spend_entries",
    )
    member = models.ForeignKey(
        FamilyMember,
        on_delete=models.CASCADE,
        related_name="spend_entries",
    )
    kind = models.CharField(max_length=25, choices=Kind.choices)
    title = models.CharField(max_length=150)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    spent_at = models.DateField()
    payer = models.CharField(max_length=10, choices=Payer.choices)
    manual_significant = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="family_spend_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-spent_at", "-id"]
        indexes = [
            models.Index(fields=["member", "spent_at"]),
            models.Index(fields=["household", "spent_at"]),
            models.Index(fields=["household", "kind", "spent_at"]),
            models.Index(fields=["household", "payer", "spent_at"]),
        ]

    @property
    def threshold_significant(self) -> bool:
        threshold = Decimal(str(getattr(settings, "FAMILY_FINANCES_SIGNIFICANT_THRESHOLD", "500.00")))
        return self.amount >= threshold

    @property
    def effective_significant(self) -> bool:
        return bool(self.manual_significant or self.threshold_significant)

    def __str__(self) -> str:
        return f"{self.member.name} - {self.title}: {self.amount}"


def get_household_for_user(user) -> Household:
    household, _ = Household.objects.get_or_create(
        owner=user,
        defaults={"name": f"{user.username}'s Household"},
    )
    return household
