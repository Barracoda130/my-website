from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model for created/updated timestamps."""

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CategoryGroup(TimeStampedModel):
    """A user-owned grouping for budget categories, e.g. Food, Bills, Income."""

    TYPE_INCOME = 'income'
    TYPE_EXPENSE = 'expense'
    TYPE_MIXED = 'mixed'

    TYPE_CHOICES = [
        (TYPE_INCOME, 'Income'),
        (TYPE_EXPENSE, 'Expense'),
        (TYPE_MIXED, 'Mixed'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budget_category_groups')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES, default=TYPE_EXPENSE)
    sort_order = models.PositiveIntegerField(default=0)
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['sort_order', 'name']
        unique_together = ('user', 'name')

    def __str__(self):
        return f'{self.name} ({self.user})'


class Category(TimeStampedModel):
    """A user-owned category used for transactions and monthly budgets."""

    TYPE_INCOME = 'income'
    TYPE_EXPENSE = 'expense'

    TYPE_CHOICES = [
        (TYPE_INCOME, 'Income'),
        (TYPE_EXPENSE, 'Expense'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budget_categories')
    group = models.ForeignKey(CategoryGroup, on_delete=models.PROTECT, related_name='categories')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    color = models.CharField(max_length=20, default='#2563eb')
    icon = models.CharField(max_length=32, blank=True)
    sort_order = models.PositiveIntegerField(default=0)
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['group__sort_order', 'sort_order', 'name']
        unique_together = ('user', 'group', 'name')

    def __str__(self):
        return f'{self.name} ({self.type})'


class Account(TimeStampedModel):
    """A user-owned money account, such as current account, savings, or cash."""

    TYPE_CURRENT = 'current'
    TYPE_SAVINGS = 'savings'
    TYPE_CASH = 'cash'
    TYPE_CREDIT_CARD = 'credit_card'
    TYPE_LOAN = 'loan'
    TYPE_INVESTMENT = 'investment'
    TYPE_OTHER = 'other'

    TYPE_CHOICES = [
        (TYPE_CURRENT, 'Current'),
        (TYPE_SAVINGS, 'Savings'),
        (TYPE_CASH, 'Cash'),
        (TYPE_CREDIT_CARD, 'Credit Card'),
        (TYPE_LOAN, 'Loan'),
        (TYPE_INVESTMENT, 'Investment'),
        (TYPE_OTHER, 'Other'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budget_accounts')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_CURRENT)
    opening_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    is_archived = models.BooleanField(default=False)

    class Meta:
        ordering = ['name']
        unique_together = ('user', 'name')

    def __str__(self):
        return f'{self.name} ({self.user})'


class Transaction(TimeStampedModel):
    """A manually entered income, expense, or transfer transaction."""

    TYPE_INCOME = 'income'
    TYPE_EXPENSE = 'expense'
    TYPE_TRANSFER = 'transfer'

    TYPE_CHOICES = [
        (TYPE_INCOME, 'Income'),
        (TYPE_EXPENSE, 'Expense'),
        (TYPE_TRANSFER, 'Transfer'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budget_transactions')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='transactions')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='transactions', null=True, blank=True)
    type = models.CharField(max_length=16, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    date = models.DateField()
    description = models.CharField(max_length=255)
    payee = models.CharField(max_length=150, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.date} {self.description} {self.amount}'


class Budget(TimeStampedModel):
    """A monthly amount allocated to an expense category."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='budgets')
    month = models.DateField(help_text='Use the first day of the month, e.g. 2026-06-01.')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])

    class Meta:
        ordering = ['month', 'category__name']
        unique_together = ('user', 'category', 'month')

    def __str__(self):
        return f'{self.category.name} {self.month:%Y-%m}: {self.amount}'


class RecurringItem(TimeStampedModel):
    """Lite recurring bill/subscription/income item for upcoming budget visibility."""

    TYPE_BILL = 'bill'
    TYPE_SUBSCRIPTION = 'subscription'
    TYPE_INCOME = 'income'

    TYPE_CHOICES = [
        (TYPE_BILL, 'Bill'),
        (TYPE_SUBSCRIPTION, 'Subscription'),
        (TYPE_INCOME, 'Income'),
    ]

    FREQUENCY_WEEKLY = 'weekly'
    FREQUENCY_MONTHLY = 'monthly'
    FREQUENCY_YEARLY = 'yearly'

    FREQUENCY_CHOICES = [
        (FREQUENCY_WEEKLY, 'Weekly'),
        (FREQUENCY_MONTHLY, 'Monthly'),
        (FREQUENCY_YEARLY, 'Yearly'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budget_recurring_items')
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='recurring_items')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='recurring_items')
    name = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    frequency = models.CharField(max_length=16, choices=FREQUENCY_CHOICES, default=FREQUENCY_MONTHLY)
    next_due_date = models.DateField()
    type = models.CharField(max_length=24, choices=TYPE_CHOICES, default=TYPE_BILL)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['next_due_date', 'name']

    def __str__(self):
        return f'{self.name} due {self.next_due_date}'
