import secrets
import string

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


def generate_family_code():
    """Generate a short family join code suitable for sharing with invited users."""
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(10))


class TimeStampedModel(models.Model):
    """Abstract base model for created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Family(TimeStampedModel):
    """A family ledger boundary, joined by invited users using a family code."""

    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, unique=True, default=generate_family_code)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_families',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'families'

    def save(self, *args, **kwargs):
        if self.code:
            self.code = self.code.strip().upper()
        super().save(*args, **kwargs)

    def ensure_default_child(self):
        """Ensure every family has at least one editable starter child."""
        if not self.children.exists():
            Child.objects.create(family=self, name='Child 1')

    def __str__(self):
        return f'{self.name} ({self.code})'


class FamilyMembership(TimeStampedModel):
    """Links website users to a family planner."""

    ROLE_ADMIN = 'admin'
    ROLE_MEMBER = 'member'

    ROLE_CHOICES = [
        (ROLE_ADMIN, 'Admin'),
        (ROLE_MEMBER, 'Member'),
    ]

    family = models.ForeignKey(Family, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='family_memberships')
    role = models.CharField(max_length=16, choices=ROLE_CHOICES, default=ROLE_MEMBER)

    class Meta:
        ordering = ['family__name', 'user__username']
        unique_together = ('family', 'user')

    def __str__(self):
        return f'{self.user} in {self.family} ({self.role})'


class Child(TimeStampedModel):
    """A child whose parental support is tracked in a family fairness ledger."""

    family = models.ForeignKey(Family, on_delete=models.CASCADE, related_name='children')
    name = models.CharField(max_length=100)
    date_of_birth = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        unique_together = ('family', 'name')

    def __str__(self):
        return f'{self.name} ({self.family.name})'


class FamilyTransaction(TimeStampedModel):
    """A financial support record for one child or split between multiple children."""

    TYPE_ALLOWANCE = 'regular_allowance'
    TYPE_ONE_OFF = 'one_off_personal_expense'
    TYPE_SHARED = 'shared_family_expense'
    TYPE_LARGE = 'large_parental_contribution'
    TYPE_EXCLUDED = 'excluded_non_fairness_expense'
    TYPE_OTHER = 'other'

    TYPE_CHOICES = [
        (TYPE_ALLOWANCE, 'Regular allowance'),
        (TYPE_ONE_OFF, 'One-off personal expense'),
        (TYPE_SHARED, 'Shared family expense'),
        (TYPE_LARGE, 'Large parental contribution'),
        (TYPE_EXCLUDED, 'Excluded / non-fairness expense'),
        (TYPE_OTHER, 'Other'),
    ]

    CATEGORY_ALLOWANCE = 'allowance'
    CATEGORY_CLOTHING = 'clothing'
    CATEGORY_EDUCATION = 'education'
    CATEGORY_TRAVEL = 'travel'
    CATEGORY_HOBBIES = 'hobbies'
    CATEGORY_TECHNOLOGY = 'technology'
    CATEGORY_DRIVING = 'driving_lessons'
    CATEGORY_GIFTS = 'gifts'
    CATEGORY_MEDICAL = 'medical'
    CATEGORY_SCHOOL = 'school_essentials'
    CATEGORY_HOLIDAYS = 'holidays'
    CATEGORY_FOOD = 'food'
    CATEGORY_OTHER = 'other'

    CATEGORY_CHOICES = [
        (CATEGORY_ALLOWANCE, 'Allowance'),
        (CATEGORY_CLOTHING, 'Clothing'),
        (CATEGORY_EDUCATION, 'Education'),
        (CATEGORY_TRAVEL, 'Travel'),
        (CATEGORY_HOBBIES, 'Hobbies'),
        (CATEGORY_TECHNOLOGY, 'Technology'),
        (CATEGORY_DRIVING, 'Driving lessons'),
        (CATEGORY_GIFTS, 'Gifts'),
        (CATEGORY_MEDICAL, 'Medical'),
        (CATEGORY_SCHOOL, 'School essentials'),
        (CATEGORY_HOLIDAYS, 'Holidays'),
        (CATEGORY_FOOD, 'Food'),
        (CATEGORY_OTHER, 'Other'),
    ]

    PAID_BY_MUM = 'mum'
    PAID_BY_DAD = 'dad'
    PAID_BY_BOTH = 'both'
    PAID_BY_OTHER = 'other'

    PAID_BY_CHOICES = [
        (PAID_BY_MUM, 'Mum'),
        (PAID_BY_DAD, 'Dad'),
        (PAID_BY_BOTH, 'Both'),
        (PAID_BY_OTHER, 'Other'),
    ]

    FREQUENCY_NONE = 'none'
    FREQUENCY_WEEKLY = 'weekly'
    FREQUENCY_MONTHLY = 'monthly'
    FREQUENCY_YEARLY = 'yearly'
    FREQUENCY_CUSTOM = 'custom'

    FREQUENCY_CHOICES = [
        (FREQUENCY_NONE, 'None'),
        (FREQUENCY_WEEKLY, 'Weekly'),
        (FREQUENCY_MONTHLY, 'Monthly'),
        (FREQUENCY_YEARLY, 'Yearly'),
        (FREQUENCY_CUSTOM, 'Custom'),
    ]

    family = models.ForeignKey(Family, on_delete=models.CASCADE, related_name='transactions')
    date = models.DateField()
    title = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    currency = models.CharField(max_length=3, default='GBP')
    type = models.CharField(max_length=40, choices=TYPE_CHOICES)
    category = models.CharField(max_length=40, choices=CATEGORY_CHOICES, default=CATEGORY_OTHER)
    paid_by = models.CharField(max_length=20, choices=PAID_BY_CHOICES, default=PAID_BY_BOTH)
    counts_toward_fairness = models.BooleanField(default=True)
    is_large_expense = models.BooleanField(default=False)
    split_between_children = models.BooleanField(default=False)
    recurring = models.BooleanField(default=False)
    recurring_frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES, default=FREQUENCY_NONE)
    recurring_start_date = models.DateField(null=True, blank=True)
    recurring_end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    receipt_url = models.URLField(blank=True)
    generated_from = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='generated_instances',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='family_transactions_created',
    )

    class Meta:
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['family', 'date']),
            models.Index(fields=['family', 'category']),
            models.Index(fields=['family', 'type']),
            models.Index(fields=['family', 'recurring']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['generated_from', 'date'],
                name='unique_generated_family_transaction_date',
            ),
        ]

    def __str__(self):
        return f'{self.date} {self.title} £{self.amount}'


class TransactionChildSplit(TimeStampedModel):
    """The amount/percentage of a transaction assigned to an individual child."""

    transaction = models.ForeignKey(FamilyTransaction, on_delete=models.CASCADE, related_name='splits')
    child = models.ForeignKey(Child, on_delete=models.CASCADE, related_name='transaction_splits')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    percentage = models.DecimalField(max_digits=5, decimal_places=2, validators=[MinValueValidator(0)])

    class Meta:
        ordering = ['child__name']
        unique_together = ('transaction', 'child')
        indexes = [
            models.Index(fields=['child', 'transaction']),
        ]

    def __str__(self):
        return f'{self.child.name}: £{self.amount} of {self.transaction.title}'
