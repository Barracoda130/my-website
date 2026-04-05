from __future__ import annotations

from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from expenses.models import ExpenseCategory, ExpenseEntry


def _month_start_for_offset(anchor: date, month_offset: int) -> date:
    year = anchor.year
    month = anchor.month + month_offset

    while month <= 0:
        month += 12
        year -= 1

    while month > 12:
        month -= 12
        year += 1

    return date(year, month, 1)


def _date_for_day(month_start: date, day: int) -> date:
    last_day = monthrange(month_start.year, month_start.month)[1]
    return month_start.replace(day=min(day, last_day))


class Command(BaseCommand):
    help = "Create or refresh a second test account with sample income and expense transactions."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="testuser2")
        parser.add_argument("--password", default="StrongPassword123!")
        parser.add_argument("--email", default="testuser2@example.com")
        parser.add_argument(
            "--months",
            type=int,
            default=10,
            help="Number of months of data to generate (minimum 1).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        username: str = options["username"]
        password: str = options["password"]
        email: str = options["email"]
        months: int = max(1, int(options["months"]))

        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username=username,
            defaults={"email": email},
        )

        should_save_user = False
        if user.email != email:
            user.email = email
            should_save_user = True

        if created or not user.check_password(password):
            user.set_password(password)
            should_save_user = True

        if should_save_user:
            user.save()

        categories = self._ensure_categories(user)

        existing_count = ExpenseEntry.objects.filter(user=user).count()
        if existing_count:
            ExpenseEntry.objects.filter(user=user).delete()

        entries = self._build_entries(user=user, categories=categories, months=months)
        ExpenseEntry.objects.bulk_create(entries)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded account '{username}' with {len(entries)} transactions across {months} months."
            )
        )
        self.stdout.write(f"Password: {password}")
        self.stdout.write(f"Previous transactions replaced: {existing_count}")

    def _ensure_categories(self, user) -> dict[str, ExpenseCategory]:
        category_specs: tuple[tuple[str, str], ...] = (
            ("Food", "#ef4444"),
            ("Transport", "#0ea5e9"),
            ("Housing", "#8b5cf6"),
            ("Utilities", "#f59e0b"),
            ("Entertainment", "#10b981"),
            ("Health", "#ec4899"),
            ("Salary", "#22c55e"),
            ("Freelance", "#16a34a"),
            ("Investments", "#14b8a6"),
        )

        categories: dict[str, ExpenseCategory] = {}
        for name, color in category_specs:
            category, _ = ExpenseCategory.objects.get_or_create(
                user=user,
                name=name,
                defaults={"color": color},
            )
            if category.color != color:
                category.color = color
                category.save(update_fields=["color"])
            categories[name] = category

        return categories

    def _build_entries(
        self,
        user,
        categories: dict[str, ExpenseCategory],
        months: int,
    ) -> list[ExpenseEntry]:
        anchor = timezone.localdate().replace(day=1)
        entries: list[ExpenseEntry] = []

        for index in range(months):
            month_start = _month_start_for_offset(anchor, -index)
            trend = months - index

            self._append_entry(
                entries,
                user,
                categories["Salary"],
                "Monthly Salary",
                ExpenseEntry.EntryType.INCOME,
                Decimal("3150.00") + Decimal(trend * 25),
                _date_for_day(month_start, 1),
                "Primary salary payment.",
            )
            self._append_entry(
                entries,
                user,
                categories["Freelance"],
                "Freelance Project",
                ExpenseEntry.EntryType.INCOME,
                Decimal("380.00") + Decimal((trend % 4) * 85),
                _date_for_day(month_start, 15),
                "Side project invoice.",
            )
            self._append_entry(
                entries,
                user,
                categories["Investments"],
                "Dividend Payment",
                ExpenseEntry.EntryType.INCOME,
                Decimal("120.00") + Decimal((trend % 3) * 35),
                _date_for_day(month_start, 22),
                "Monthly portfolio distribution.",
            )

            self._append_entry(
                entries,
                user,
                categories["Housing"],
                "Rent",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("1250.00"),
                _date_for_day(month_start, 2),
                "Monthly apartment rent.",
            )
            self._append_entry(
                entries,
                user,
                categories["Utilities"],
                "Utilities",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("130.00") + Decimal((trend % 2) * 12),
                _date_for_day(month_start, 4),
                "Electricity, water, and internet.",
            )
            self._append_entry(
                entries,
                user,
                categories["Food"],
                "Groceries",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("260.00") + Decimal((trend % 5) * 22),
                _date_for_day(month_start, 6),
                "Weekly grocery restock.",
            )
            self._append_entry(
                entries,
                user,
                categories["Transport"],
                "Transport Pass",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("88.00") + Decimal((trend % 3) * 9),
                _date_for_day(month_start, 8),
                "Train and bus monthly pass.",
            )
            self._append_entry(
                entries,
                user,
                categories["Health"],
                "Gym Membership",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("54.00"),
                _date_for_day(month_start, 10),
                "Health and fitness subscription.",
            )
            self._append_entry(
                entries,
                user,
                categories["Entertainment"],
                "Streaming + Games",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("42.00") + Decimal((trend % 4) * 6),
                _date_for_day(month_start, 12),
                "Leisure subscriptions and gaming.",
            )
            self._append_entry(
                entries,
                user,
                categories["Food"],
                "Restaurant Night",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("72.00") + Decimal((trend % 3) * 18),
                _date_for_day(month_start, 18),
                "Dining out with friends.",
            )
            self._append_entry(
                entries,
                user,
                categories["Housing"],
                "Home Supplies",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("58.00") + Decimal((trend % 2) * 14),
                _date_for_day(month_start, 20),
                "Household and maintenance items.",
            )
            self._append_entry(
                entries,
                user,
                categories["Entertainment"],
                "Weekend Activity",
                ExpenseEntry.EntryType.EXPENSE,
                Decimal("40.00") + Decimal((trend % 5) * 10),
                _date_for_day(month_start, 25),
                "Cinema, events, or local trips.",
            )

        return entries

    def _append_entry(
        self,
        entries: list[ExpenseEntry],
        user,
        category: ExpenseCategory,
        title: str,
        entry_type: str,
        amount: Decimal,
        spent_at: date,
        notes: str,
    ) -> None:
        entries.append(
            ExpenseEntry(
                user=user,
                category=category,
                title=title,
                notes=notes,
                entry_type=entry_type,
                amount=amount.quantize(Decimal("0.01")),
                spent_at=spent_at,
            )
        )
