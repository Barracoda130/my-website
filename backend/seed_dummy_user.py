"""
Seed the development database with a realistic dummy Budget Tracker user.

Run from the backend directory:
    python seed_dummy_user.py

The script is idempotent for the dummy user's setup data: it creates or updates
the same user, module access, accounts, categories, budgets, recurring items,
and a representative set of monthly transactions.
"""

import os
from datetime import date, timedelta
from decimal import Decimal

import django


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()


from django.contrib.auth.models import User  # noqa: E402
from django.db import transaction as db_transaction  # noqa: E402

from budget_tracker.models import (  # noqa: E402
    Account,
    Budget,
    Category,
    CategoryGroup,
    RecurringItem,
    Transaction,
)
from users.models import UserGroup, UserModuleAccess  # noqa: E402


USERNAME = "dummy.budget.user"
PASSWORD = "DummyPass123!"
EMAIL = "dummy.budget.user@example.com"
FIRST_NAME = "Daisy"
LAST_NAME = "Budget"


def first_day_of_month(value):
    return value.replace(day=1)


def add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def money(value):
    return Decimal(value).quantize(Decimal("0.01"))


def upsert_category_group(user, name, group_type, sort_order):
    group, _ = CategoryGroup.objects.update_or_create(
        user=user,
        name=name,
        defaults={"type": group_type, "sort_order": sort_order, "is_archived": False},
    )
    return group


def upsert_category(user, group, name, category_type, color, icon, sort_order):
    category, _ = Category.objects.update_or_create(
        user=user,
        group=group,
        name=name,
        defaults={
            "type": category_type,
            "color": color,
            "icon": icon,
            "sort_order": sort_order,
            "is_archived": False,
        },
    )
    return category


def upsert_account(user, name, account_type, opening_balance):
    account, _ = Account.objects.update_or_create(
        user=user,
        name=name,
        defaults={
            "type": account_type,
            "opening_balance": money(opening_balance),
            "is_archived": False,
        },
    )
    return account


def upsert_budget(user, category, month, amount):
    budget, _ = Budget.objects.update_or_create(
        user=user,
        category=category,
        month=month,
        defaults={"amount": money(amount)},
    )
    return budget


def upsert_recurring_item(user, account, category, name, amount, frequency, next_due_date, item_type, notes=""):
    recurring_item, _ = RecurringItem.objects.update_or_create(
        user=user,
        name=name,
        defaults={
            "account": account,
            "category": category,
            "amount": money(amount),
            "frequency": frequency,
            "next_due_date": next_due_date,
            "type": item_type,
            "is_active": True,
            "notes": notes,
        },
    )
    return recurring_item


def reset_and_create_transactions(user, account, categories, current_month):
    Transaction.objects.filter(user=user).delete()

    transaction_specs = [
        # Current month income
        (2, "income", "3200.00", categories["Salary"], "Acme Ltd", "Monthly salary", "Net monthly pay"),
        (8, "income", "180.00", categories["Freelance"], "Side project", "Landing page build", "Small freelance job"),
        # Current month bills and day-to-day spending
        (1, "expense", "950.00", categories["Rent"], "Landlord", "Monthly rent", "Standing order"),
        (3, "expense", "82.00", categories["Utilities"], "Octopus Energy", "Electricity and gas", "Estimated bill"),
        (4, "expense", "42.50", categories["Internet"], "Hyperoptic", "Broadband", ""),
        (5, "expense", "74.20", categories["Groceries"], "Tesco", "Weekly food shop", ""),
        (9, "expense", "38.75", categories["Groceries"], "Aldi", "Top-up groceries", ""),
        (10, "expense", "16.99", categories["Subscriptions"], "Netflix", "Streaming subscription", ""),
        (12, "expense", "12.50", categories["Transport"], "TfL", "Tube travel", ""),
        (14, "expense", "54.00", categories["Dining Out"], "Nando's", "Dinner with friends", ""),
        (15, "expense", "28.40", categories["Household"], "B&Q", "Cleaning and household supplies", ""),
        (17, "expense", "120.00", categories["Savings"], "Internal transfer", "Monthly savings contribution", "Tracked as savings category for budget visibility"),
        (18, "expense", "21.95", categories["Health"], "Boots", "Pharmacy", ""),
        (21, "expense", "64.80", categories["Groceries"], "Sainsbury's", "Weekly food shop", ""),
        (23, "expense", "35.00", categories["Entertainment"], "Vue Cinema", "Cinema night", ""),
        # Previous month sample history
        (-29, "income", "3200.00", categories["Salary"], "Acme Ltd", "Previous salary", ""),
        (-28, "expense", "950.00", categories["Rent"], "Landlord", "Previous rent", ""),
        (-24, "expense", "68.10", categories["Groceries"], "Tesco", "Previous groceries", ""),
        (-19, "expense", "45.00", categories["Dining Out"], "Local Cafe", "Birthday brunch", ""),
        (-12, "expense", "13.99", categories["Subscriptions"], "Spotify", "Music subscription", ""),
    ]

    created = []
    for day_offset_or_day, transaction_type, amount, category, payee, description, notes in transaction_specs:
        if day_offset_or_day > 0:
            transaction_date = current_month + timedelta(days=day_offset_or_day - 1)
        else:
            transaction_date = current_month + timedelta(days=day_offset_or_day)

        created.append(
            Transaction.objects.create(
                user=user,
                account=account,
                category=category,
                type=transaction_type,
                amount=money(amount),
                date=transaction_date,
                payee=payee,
                description=description,
                notes=notes,
            )
        )

    return created


@db_transaction.atomic
def seed():
    user, created = User.objects.update_or_create(
        username=USERNAME,
        defaults={
            "email": EMAIL,
            "first_name": FIRST_NAME,
            "last_name": LAST_NAME,
            "is_active": True,
        },
    )
    user.set_password(PASSWORD)
    user.save()

    UserModuleAccess.objects.get_or_create(
        user=user,
        module="budget_tracker",
        defaults={"granted_by": None},
    )

    household_group, _ = UserGroup.objects.get_or_create(name="Dummy Household", defaults={"created_by": user})
    household_group.members.add(user)

    income_group = upsert_category_group(user, "Income", CategoryGroup.TYPE_INCOME, 10)
    bills_group = upsert_category_group(user, "Bills", CategoryGroup.TYPE_EXPENSE, 20)
    living_group = upsert_category_group(user, "Living Costs", CategoryGroup.TYPE_EXPENSE, 30)
    lifestyle_group = upsert_category_group(user, "Lifestyle", CategoryGroup.TYPE_EXPENSE, 40)
    goals_group = upsert_category_group(user, "Goals", CategoryGroup.TYPE_EXPENSE, 50)

    categories = {
        "Salary": upsert_category(user, income_group, "Salary", Category.TYPE_INCOME, "#16a34a", "briefcase", 10),
        "Freelance": upsert_category(user, income_group, "Freelance", Category.TYPE_INCOME, "#22c55e", "laptop", 20),
        "Rent": upsert_category(user, bills_group, "Rent", Category.TYPE_EXPENSE, "#dc2626", "home", 10),
        "Utilities": upsert_category(user, bills_group, "Utilities", Category.TYPE_EXPENSE, "#f97316", "bolt", 20),
        "Internet": upsert_category(user, bills_group, "Internet", Category.TYPE_EXPENSE, "#0ea5e9", "wifi", 30),
        "Subscriptions": upsert_category(user, bills_group, "Subscriptions", Category.TYPE_EXPENSE, "#8b5cf6", "repeat", 40),
        "Groceries": upsert_category(user, living_group, "Groceries", Category.TYPE_EXPENSE, "#65a30d", "shopping-cart", 10),
        "Transport": upsert_category(user, living_group, "Transport", Category.TYPE_EXPENSE, "#0891b2", "train", 20),
        "Household": upsert_category(user, living_group, "Household", Category.TYPE_EXPENSE, "#ca8a04", "sparkles", 30),
        "Dining Out": upsert_category(user, lifestyle_group, "Dining Out", Category.TYPE_EXPENSE, "#db2777", "utensils", 10),
        "Entertainment": upsert_category(user, lifestyle_group, "Entertainment", Category.TYPE_EXPENSE, "#7c3aed", "ticket", 20),
        "Health": upsert_category(user, lifestyle_group, "Health", Category.TYPE_EXPENSE, "#e11d48", "heart", 30),
        "Savings": upsert_category(user, goals_group, "Savings", Category.TYPE_EXPENSE, "#2563eb", "piggy-bank", 10),
    }

    current_account = upsert_account(user, "Dummy Current Account", Account.TYPE_CURRENT, "1250.00")
    upsert_account(user, "Dummy Emergency Savings", Account.TYPE_SAVINGS, "2400.00")
    upsert_account(user, "Dummy Cash Wallet", Account.TYPE_CASH, "45.00")
    upsert_account(user, "Dummy Credit Card", Account.TYPE_CREDIT_CARD, "-215.35")

    current_month = first_day_of_month(date.today())
    next_month = add_months(current_month, 1)

    budget_amounts = {
        "Rent": "950.00",
        "Utilities": "140.00",
        "Internet": "45.00",
        "Subscriptions": "60.00",
        "Groceries": "360.00",
        "Transport": "120.00",
        "Household": "80.00",
        "Dining Out": "180.00",
        "Entertainment": "100.00",
        "Health": "75.00",
        "Savings": "300.00",
    }
    for category_name, amount in budget_amounts.items():
        upsert_budget(user, categories[category_name], current_month, amount)

    # Seed a small preview of next month too, to make month filtering useful.
    for category_name, amount in {"Rent": "950.00", "Groceries": "375.00", "Savings": "325.00"}.items():
        upsert_budget(user, categories[category_name], next_month, amount)

    upsert_recurring_item(
        user,
        current_account,
        categories["Salary"],
        "Monthly Salary",
        "3200.00",
        RecurringItem.FREQUENCY_MONTHLY,
        add_months(current_month, 1) + timedelta(days=1),
        RecurringItem.TYPE_INCOME,
        "Main employment income.",
    )
    upsert_recurring_item(
        user,
        current_account,
        categories["Rent"],
        "Rent Standing Order",
        "950.00",
        RecurringItem.FREQUENCY_MONTHLY,
        add_months(current_month, 1),
        RecurringItem.TYPE_BILL,
        "Paid on the first of each month.",
    )
    upsert_recurring_item(
        user,
        current_account,
        categories["Utilities"],
        "Energy Bill",
        "82.00",
        RecurringItem.FREQUENCY_MONTHLY,
        current_month + timedelta(days=27),
        RecurringItem.TYPE_BILL,
    )
    upsert_recurring_item(
        user,
        current_account,
        categories["Subscriptions"],
        "Netflix",
        "16.99",
        RecurringItem.FREQUENCY_MONTHLY,
        current_month + timedelta(days=9),
        RecurringItem.TYPE_SUBSCRIPTION,
    )
    upsert_recurring_item(
        user,
        current_account,
        categories["Subscriptions"],
        "Annual Cloud Storage",
        "79.99",
        RecurringItem.FREQUENCY_YEARLY,
        date(current_month.year, 12, 15),
        RecurringItem.TYPE_SUBSCRIPTION,
    )

    transactions = reset_and_create_transactions(user, current_account, categories, current_month)

    return {
        "user": user,
        "created": created,
        "transactions_count": len(transactions),
        "categories_count": len(categories),
        "current_month": current_month,
    }


if __name__ == "__main__":
    result = seed()
    user = result["user"]
    print("Dummy Budget Tracker user seeded successfully.")
    print(f"Username: {user.username}")
    print(f"Password: {PASSWORD}")
    print(f"Email: {user.email}")
    print(f"Created new user: {result['created']}")
    print(f"Categories: {result['categories_count']}")
    print(f"Transactions recreated: {result['transactions_count']}")
    print(f"Budget month: {result['current_month']:%Y-%m}")