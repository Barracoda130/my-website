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
