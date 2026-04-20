from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import get_user_section_access
from .models import FamilyMember, get_household_for_user


class FamilyFinancesApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.password = "StrongPassword123!"
        self.user = get_user_model().objects.create_user(
            username="familyowner",
            password=self.password,
            email="familyowner@example.com",
        )
        self.client = APIClient(enforce_csrf_checks=True)
        self._authenticate()
        self.household = get_household_for_user(self.user)

    def _authenticate(self):
        csrf_response = self.client.get(reverse("auth-csrf"))
        csrf_token = csrf_response.cookies["csrftoken"].value
        response = self.client.post(
            reverse("auth-login"),
            {"username": self.user.username, "password": self.password},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        refresh_response = self.client.get(reverse("auth-csrf"))
        self.csrf_token = refresh_response.cookies["csrftoken"].value

    def test_member_create_and_list(self):
        create_response = self.client.post(
            reverse("family-member-list"),
            {"name": "Alice", "role": "child", "is_active": True},
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        list_response = self.client.get(reverse("family-member-list"))
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(list_response.data[0]["name"], "Alice")

    def test_allowance_and_spend_filters(self):
        child = FamilyMember.objects.create(
            household=self.household,
            name="Ben",
            role=FamilyMember.Role.CHILD,
        )

        allowance_response = self.client.post(
            reverse("family-allowance-list"),
            {
                "member": child.id,
                "amount": "50.00",
                "received_at": "2026-04-01",
                "notes": "April allowance",
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(allowance_response.status_code, status.HTTP_201_CREATED)

        spend_response = self.client.post(
            reverse("family-spend-list"),
            {
                "member": child.id,
                "kind": "holiday",
                "title": "Theme Park",
                "amount": "120.00",
                "spent_at": "2026-04-02",
                "payer": "parent",
                "manual_significant": False,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(spend_response.status_code, status.HTTP_201_CREATED)

        filtered_allowances = self.client.get(reverse("family-allowance-list"), {"member": child.id})
        self.assertEqual(filtered_allowances.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered_allowances.data), 1)

        filtered_spend = self.client.get(reverse("family-spend-list"), {"payer": "parent", "kind": "holiday"})
        self.assertEqual(filtered_spend.status_code, status.HTTP_200_OK)
        self.assertEqual(len(filtered_spend.data), 1)

    def test_comparison_summary_values(self):
        child = FamilyMember.objects.create(
            household=self.household,
            name="Cara",
            role=FamilyMember.Role.CHILD,
        )

        self.client.post(
            reverse("family-allowance-list"),
            {
                "member": child.id,
                "amount": "200.00",
                "received_at": "2026-04-01",
                "notes": "Monthly allowance",
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.client.post(
            reverse("family-spend-list"),
            {
                "member": child.id,
                "kind": "significant_purchase",
                "title": "Laptop",
                "amount": "150.00",
                "spent_at": "2026-04-03",
                "payer": "child",
                "manual_significant": True,
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )

        summary_response = self.client.get(reverse("family-comparison-summary"))
        self.assertEqual(summary_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(summary_response.data["members"]), 1)

        row = summary_response.data["members"][0]
        self.assertEqual(row["member_name"], "Cara")
        self.assertEqual(Decimal(row["allowance_received"]), Decimal("200.00"))
        self.assertEqual(Decimal(row["child_paid_total"]), Decimal("150.00"))
        self.assertEqual(Decimal(row["net_position"]), Decimal("50.00"))

    def test_section_permission_blocks_access(self):
        access = get_user_section_access(self.user)
        access.can_access_family_finances = False
        access.save(update_fields=["can_access_family_finances", "updated_at"])

        response = self.client.get(reverse("family-member-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_recurring_allowance_by_payment_count_creates_multiple_rows(self):
        child = FamilyMember.objects.create(
            household=self.household,
            name="Dani",
            role=FamilyMember.Role.CHILD,
        )

        response = self.client.post(
            reverse("family-allowance-list"),
            {
                "member": child.id,
                "amount": "25.00",
                "received_at": "2026-04-01",
                "is_recurring": True,
                "recurring_interval": "weekly",
                "recurring_payment_count": 4,
                "notes": "Weekly allowance",
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        entries = self.client.get(reverse("family-allowance-list"), {"member": child.id})
        self.assertEqual(entries.status_code, status.HTTP_200_OK)
        self.assertEqual(len(entries.data), 4)

    def test_recurring_allowance_rejects_both_end_date_and_payment_count(self):
        child = FamilyMember.objects.create(
            household=self.household,
            name="Elliot",
            role=FamilyMember.Role.CHILD,
        )

        response = self.client.post(
            reverse("family-allowance-list"),
            {
                "member": child.id,
                "amount": "30.00",
                "received_at": "2026-04-01",
                "is_recurring": True,
                "recurring_interval": "monthly",
                "recurring_payment_count": 3,
                "recurring_end_date": "2026-07-01",
            },
            format="json",
            HTTP_X_CSRFTOKEN=self.csrf_token,
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
