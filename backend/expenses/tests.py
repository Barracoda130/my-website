from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import ExpenseCategory, ExpenseEntry


class ExpenseApiTests(APITestCase):
    def setUp(self):
        self.user_password = "StrongPassword123!"
        self.user = get_user_model().objects.create_user(
            username="expense-user",
            password=self.user_password,
            email="expense-user@example.com",
        )
        self.other_user = get_user_model().objects.create_user(
            username="other-user",
            password="StrongPassword123!",
            email="other-user@example.com",
        )

        self.client = APIClient(enforce_csrf_checks=True)

        self.csrf_url = reverse("auth-csrf")
        self.login_url = reverse("auth-login")
        self.categories_url = reverse("expense-category-list")
        self.budgets_url = reverse("expense-budget-list")
        self.entries_url = reverse("expense-entry-list")
        self.summary_url = reverse("expense-summary")

    def _authenticate(self):
        csrf_response = self.client.get(self.csrf_url)
        csrf_token = csrf_response.cookies["csrftoken"].value
        login_response = self.client.post(
            self.login_url,
            {"username": self.user.username, "password": self.user_password},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

        if "csrftoken" in self.client.cookies:
            return self.client.cookies["csrftoken"].value
        return csrf_token

    def test_category_list_bootstraps_default_categories(self):
        self._authenticate()

        list_response = self.client.get(self.categories_url)

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        category_names = {item["name"] for item in list_response.data}
        self.assertIn("Food", category_names)
        self.assertIn("Transport", category_names)
        self.assertIn("Housing", category_names)

    def test_create_and_list_custom_category(self):
        csrf_token = self._authenticate()
        self.client.get(self.categories_url)

        create_response = self.client.post(
            self.categories_url,
            {"name": "Pet Care", "color": "#22c55e"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(self.categories_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        category_names = [item["name"] for item in list_response.data]
        self.assertIn("Pet Care", category_names)

    def test_default_categories_are_seeded_only_once(self):
        self._authenticate()

        first_response = self.client.get(self.categories_url)
        second_response = self.client.get(self.categories_url)

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(first_response.data), len(second_response.data))

    def test_category_detail_is_scoped_to_authenticated_user(self):
        self._authenticate()

        other_category = ExpenseCategory.objects.create(
            user=self.other_user,
            name="Other Private Category",
        )

        detail_url = reverse("expense-category-detail", kwargs={"pk": other_category.id})
        detail_response = self.client.get(detail_url)

        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_category_update_rejects_other_users_category(self):
        csrf_token = self._authenticate()

        other_category = ExpenseCategory.objects.create(
            user=self.other_user,
            name="Other Hidden Category",
        )

        detail_url = reverse("expense-category-detail", kwargs={"pk": other_category.id})
        response = self.client.patch(
            detail_url,
            {"name": "Attempted Rename"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_category_delete_rejects_other_users_category(self):
        csrf_token = self._authenticate()

        other_category = ExpenseCategory.objects.create(
            user=self.other_user,
            name="Other Protected Category",
        )

        detail_url = reverse("expense-category-detail", kwargs={"pk": other_category.id})
        response = self.client.delete(detail_url, HTTP_X_CSRFTOKEN=csrf_token)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ExpenseCategory.objects.filter(id=other_category.id).exists())

    def test_create_entry_rejects_other_users_category(self):
        csrf_token = self._authenticate()

        foreign_category = ExpenseCategory.objects.create(
            user=self.other_user,
            name="Foreign",
        )

        response = self.client.post(
            self.entries_url,
            {
                "title": "Invalid category expense",
                "amount": "12.40",
                "spent_at": "2026-04-01",
                "category": foreign_category.id,
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_create_and_list_budget(self):
        csrf_token = self._authenticate()
        category = ExpenseCategory.objects.create(user=self.user, name="Home")

        create_response = self.client.post(
            self.budgets_url,
            {
                "category": category.id,
                "amount": "750.00",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(create_response.data["category_name"], "Home")

        list_response = self.client.get(self.budgets_url)
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(Decimal(list_response.data[0]["amount"]), Decimal("750.00"))

    def test_create_budget_rejects_other_users_category(self):
        csrf_token = self._authenticate()

        foreign_category = ExpenseCategory.objects.create(
            user=self.other_user,
            name="Foreign Budget",
        )

        response = self.client.post(
            self.budgets_url,
            {
                "category": foreign_category.id,
                "amount": "100.00",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_budget_detail_is_scoped_to_authenticated_user(self):
        self._authenticate()
        category = ExpenseCategory.objects.create(user=self.other_user, name="Other Home")
        other_budget = self.other_user.expense_budgets.create(category=category, amount="900.00")

        detail_url = reverse("expense-budget-detail", kwargs={"pk": other_budget.id})
        detail_response = self.client.get(detail_url)

        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_budget_list_excludes_other_users_budgets(self):
        self._authenticate()

        my_category = ExpenseCategory.objects.create(user=self.user, name="My Budget Category")
        other_category = ExpenseCategory.objects.create(user=self.other_user, name="Other Budget Category")
        self.user.expense_budgets.create(category=my_category, amount="250.00")
        self.other_user.expense_budgets.create(category=other_category, amount="999.00")

        response = self.client.get(self.budgets_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["category_name"], "My Budget Category")

    def test_budget_update_rejects_other_users_budget(self):
        csrf_token = self._authenticate()
        category = ExpenseCategory.objects.create(user=self.other_user, name="Other Budget")
        other_budget = self.other_user.expense_budgets.create(category=category, amount="400.00")

        detail_url = reverse("expense-budget-detail", kwargs={"pk": other_budget.id})
        response = self.client.patch(
            detail_url,
            {"amount": "550.00"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_budget_delete_rejects_other_users_budget(self):
        csrf_token = self._authenticate()
        category = ExpenseCategory.objects.create(user=self.other_user, name="Other Budget")
        other_budget = self.other_user.expense_budgets.create(category=category, amount="400.00")

        detail_url = reverse("expense-budget-detail", kwargs={"pk": other_budget.id})
        response = self.client.delete(detail_url, HTTP_X_CSRFTOKEN=csrf_token)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(self.other_user.expense_budgets.filter(id=other_budget.id).exists())

    def test_create_income_entry(self):
        csrf_token = self._authenticate()

        response = self.client.post(
            self.entries_url,
            {
                "title": "Salary",
                "amount": "2500.00",
                "spent_at": "2026-04-01",
                "entry_type": "income",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["entry_type"], "income")

    def test_entry_detail_is_scoped_to_authenticated_user(self):
        self._authenticate()

        other_entry = ExpenseEntry.objects.create(
            user=self.other_user,
            title="Other user entry",
            amount="50.00",
            spent_at=date(2026, 4, 1),
        )

        detail_url = reverse("expense-entry-detail", kwargs={"pk": other_entry.id})
        detail_response = self.client.get(detail_url)

        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_entries_list_excludes_other_users_entries(self):
        self._authenticate()

        ExpenseEntry.objects.create(
            user=self.user,
            title="My entry",
            amount="40.00",
            spent_at=date(2026, 4, 1),
        )
        ExpenseEntry.objects.create(
            user=self.other_user,
            title="Other user private entry",
            amount="999.00",
            spent_at=date(2026, 4, 1),
        )

        response = self.client.get(self.entries_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["title"], "My entry")

    def test_entry_update_rejects_other_users_entry(self):
        csrf_token = self._authenticate()

        other_entry = ExpenseEntry.objects.create(
            user=self.other_user,
            title="Other user entry",
            amount="50.00",
            spent_at=date(2026, 4, 1),
        )

        detail_url = reverse("expense-entry-detail", kwargs={"pk": other_entry.id})
        response = self.client.patch(
            detail_url,
            {"title": "Attempted overwrite"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_entry_delete_rejects_other_users_entry(self):
        csrf_token = self._authenticate()

        other_entry = ExpenseEntry.objects.create(
            user=self.other_user,
            title="Other user entry",
            amount="50.00",
            spent_at=date(2026, 4, 1),
        )

        detail_url = reverse("expense-entry-detail", kwargs={"pk": other_entry.id})
        response = self.client.delete(detail_url, HTTP_X_CSRFTOKEN=csrf_token)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(ExpenseEntry.objects.filter(id=other_entry.id).exists())

    def test_entries_support_filtering_by_date_range(self):
        csrf_token = self._authenticate()
        category = ExpenseCategory.objects.create(user=self.user, name="Bills")

        payloads = [
            {"title": "Internet", "amount": "40.00", "spent_at": "2026-04-01"},
            {"title": "Power", "amount": "80.00", "spent_at": "2026-04-03"},
            {"title": "Phone", "amount": "25.00", "spent_at": "2026-04-08"},
        ]
        for payload in payloads:
            payload["category"] = category.id
            response = self.client.post(
                self.entries_url,
                payload,
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(f"{self.entries_url}?from=2026-04-02&to=2026-04-07")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["title"], "Power")

    def test_entries_support_filtering_by_entry_type(self):
        csrf_token = self._authenticate()

        entries = [
            {"title": "Lunch", "amount": "14.50", "spent_at": "2026-04-01", "entry_type": "expense"},
            {
                "title": "Monthly Salary",
                "amount": "2500.00",
                "spent_at": "2026-04-05",
                "entry_type": "income",
            },
        ]

        for payload in entries:
            response = self.client.post(
                self.entries_url,
                payload,
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        expense_response = self.client.get(f"{self.entries_url}?entry_type=expense")
        income_response = self.client.get(f"{self.entries_url}?entry_type=income")

        self.assertEqual(expense_response.status_code, status.HTTP_200_OK)
        self.assertEqual(income_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(expense_response.data), 1)
        self.assertEqual(expense_response.data[0]["entry_type"], "expense")
        self.assertEqual(len(income_response.data), 1)
        self.assertEqual(income_response.data[0]["entry_type"], "income")

    def test_entries_reject_invalid_entry_type_filter(self):
        self._authenticate()

        response = self.client.get(f"{self.entries_url}?entry_type=invalid")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("entry_type", response.data)

    def test_entries_support_search_by_title_and_notes(self):
        csrf_token = self._authenticate()

        entries = [
            {
                "title": "Coffee beans",
                "notes": "Ethiopian roast",
                "amount": "14.50",
                "spent_at": "2026-04-01",
                "entry_type": "expense",
            },
            {
                "title": "Office supplies",
                "notes": "Notebook and coffee filters",
                "amount": "22.00",
                "spent_at": "2026-04-03",
                "entry_type": "expense",
            },
            {
                "title": "Salary",
                "notes": "Monthly payment",
                "amount": "2500.00",
                "spent_at": "2026-04-05",
                "entry_type": "income",
            },
        ]

        for payload in entries:
            response = self.client.post(
                self.entries_url,
                payload,
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.get(f"{self.entries_url}?search=coffee")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        titles = {item["title"] for item in response.data}
        self.assertIn("Coffee beans", titles)
        self.assertIn("Office supplies", titles)

    def test_summary_returns_aggregated_totals(self):
        csrf_token = self._authenticate()
        food = ExpenseCategory.objects.create(user=self.user, name="Food")
        travel = ExpenseCategory.objects.create(user=self.user, name="Travel")

        entries = [
            {"title": "Lunch", "amount": "14.50", "spent_at": "2026-04-01", "category": food.id},
            {"title": "Groceries", "amount": "55.75", "spent_at": "2026-04-02", "category": food.id},
            {"title": "Taxi", "amount": "22.00", "spent_at": "2026-04-03", "category": travel.id},
        ]
        for payload in entries:
            response = self.client.post(
                self.entries_url,
                payload,
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        summary_response = self.client.get(self.summary_url)

        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data["total_count"], 3)
        self.assertEqual(Decimal(summary_response.data["total_amount"]), Decimal("92.25"))
        self.assertEqual(summary_response.data["by_category"][0]["category_name"], "Food")

    def test_summary_excludes_income_from_total_spend(self):
        csrf_token = self._authenticate()
        salary_category = ExpenseCategory.objects.create(user=self.user, name="Salary")

        entries = [
            {"title": "Lunch", "amount": "14.50", "spent_at": "2026-04-01", "entry_type": "expense"},
            {"title": "Taxi", "amount": "22.00", "spent_at": "2026-04-03", "entry_type": "expense"},
            {
                "title": "Monthly Salary",
                "amount": "2500.00",
                "spent_at": "2026-04-05",
                "entry_type": "income",
                "category": salary_category.id,
            },
        ]

        for payload in entries:
            response = self.client.post(
                self.entries_url,
                payload,
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        summary_response = self.client.get(self.summary_url)

        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data["total_count"], 3)
        self.assertEqual(Decimal(summary_response.data["total_amount"]), Decimal("36.50"))
        self.assertTrue(
            all(row["category_name"] != "Salary" for row in summary_response.data["by_category"])
        )

    def test_summary_excludes_other_users_entries(self):
        csrf_token = self._authenticate()

        my_entry = self.client.post(
            self.entries_url,
            {
                "title": "My expense",
                "amount": "10.00",
                "spent_at": "2026-04-01",
                "entry_type": "expense",
            },
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(my_entry.status_code, status.HTTP_201_CREATED)

        ExpenseEntry.objects.create(
            user=self.other_user,
            title="Other hidden expense",
            amount="999.00",
            spent_at=date(2026, 4, 1),
            entry_type=ExpenseEntry.EntryType.EXPENSE,
        )

        summary_response = self.client.get(self.summary_url)

        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(summary_response.data["total_count"], 1)
        self.assertEqual(Decimal(summary_response.data["total_amount"]), Decimal("10.00"))
