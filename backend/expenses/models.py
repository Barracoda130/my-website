from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


class ExpenseCategory(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_categories",
    )
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=7, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="uniq_expense_category_name_per_user",
            )
        ]

    def __str__(self) -> str:
        return self.name


class ExpenseEntry(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expense_entries",
    )
    category = models.ForeignKey(
        ExpenseCategory,
        on_delete=models.SET_NULL,
        related_name="entries",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=120)
    notes = models.TextField(blank=True)
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    spent_at = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-spent_at", "-id"]
        indexes = [
            models.Index(fields=["user", "spent_at"]),
            models.Index(fields=["user", "category"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.amount})"
