from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import UserModuleAccess

from .models import Account, Budget, Category, CategoryGroup, RecurringItem, Transaction


class BudgetTrackerSecurityTests(APITestCase):
    """Security tests for Budget Tracker module access and per-user data isolation."""

    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='test-password-123')
        self.other_user = User.objects.create_user(username='other', password='test-password-123')
        self.no_access_user = User.objects.create_user(username='no-access', password='test-password-123')

        UserModuleAccess.objects.create(user=self.owner, module='budget_tracker', granted_by=self.owner)
        UserModuleAccess.objects.create(user=self.other_user, module='budget_tracker', granted_by=self.owner)

        self.owner_data = self._create_budget_data(self.owner, 'Owner')
        self.other_data = self._create_budget_data(self.other_user, 'Other')

    def _create_budget_data(self, user, prefix):
        income_group = CategoryGroup.objects.create(user=user, name=f'{prefix} Income', type=CategoryGroup.TYPE_INCOME)
        expense_group = CategoryGroup.objects.create(user=user, name=f'{prefix} Bills', type=CategoryGroup.TYPE_EXPENSE)
        income_category = Category.objects.create(
            user=user,
            group=income_group,
            name=f'{prefix} Salary',
            type=Category.TYPE_INCOME,
        )
        expense_category = Category.objects.create(
            user=user,
            group=expense_group,
            name=f'{prefix} Rent',
            type=Category.TYPE_EXPENSE,
        )
        account = Account.objects.create(user=user, name=f'{prefix} Current Account')
        transaction = Transaction.objects.create(
            user=user,
            account=account,
            category=expense_category,
            type=Transaction.TYPE_EXPENSE,
            amount=Decimal('25.00'),
            date=date(2026, 6, 15),
            description=f'{prefix} transaction',
        )
        budget = Budget.objects.create(
            user=user,
            category=expense_category,
            month=date(2026, 6, 1),
            amount=Decimal('500.00'),
        )
        recurring_item = RecurringItem.objects.create(
            user=user,
            account=account,
            category=expense_category,
            name=f'{prefix} subscription',
            amount=Decimal('9.99'),
            frequency=RecurringItem.FREQUENCY_MONTHLY,
            next_due_date=date(2026, 6, 20),
            type=RecurringItem.TYPE_SUBSCRIPTION,
        )
        return {
            'income_group': income_group,
            'expense_group': expense_group,
            'income_category': income_category,
            'expense_category': expense_category,
            'account': account,
            'transaction': transaction,
            'budget': budget,
            'recurring_item': recurring_item,
        }

    def _authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_budget_endpoints_reject_unauthenticated_users(self):
        endpoints = [
            ('get', '/api/budget/summary/'),
            ('post', '/api/budget/bootstrap-defaults/'),
            ('get', '/api/budget/category-groups/'),
            ('get', '/api/budget/categories/'),
            ('get', '/api/budget/accounts/'),
            ('get', '/api/budget/transactions/'),
            ('get', '/api/budget/budgets/'),
            ('get', '/api/budget/recurring-items/'),
        ]

        for method, url in endpoints:
            with self.subTest(url=url):
                response = getattr(self.client, method)(url)
                self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_budget_endpoints_reject_authenticated_users_without_module_access(self):
        self._authenticate(self.no_access_user)

        endpoints = [
            ('get', '/api/budget/summary/'),
            ('post', '/api/budget/bootstrap-defaults/'),
            ('get', '/api/budget/category-groups/'),
            ('get', '/api/budget/categories/'),
            ('get', '/api/budget/accounts/'),
            ('get', '/api/budget/transactions/'),
            ('get', '/api/budget/budgets/'),
            ('get', '/api/budget/recurring-items/'),
        ]

        for method, url in endpoints:
            with self.subTest(url=url):
                response = getattr(self.client, method)(url)
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_budget_endpoints_allow_users_with_module_access(self):
        self._authenticate(self.owner)

        endpoints = [
            ('get', '/api/budget/summary/?month=2026-06'),
            ('get', '/api/budget/category-groups/'),
            ('get', '/api/budget/categories/'),
            ('get', '/api/budget/accounts/'),
            ('get', '/api/budget/transactions/'),
            ('get', '/api/budget/budgets/'),
            ('get', '/api/budget/recurring-items/'),
        ]

        for method, url in endpoints:
            with self.subTest(url=url):
                response = getattr(self.client, method)(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_endpoints_only_return_current_users_records(self):
        self._authenticate(self.owner)

        endpoints = [
            ('/api/budget/category-groups/', self.owner_data['expense_group'].id, self.other_data['expense_group'].id),
            ('/api/budget/categories/', self.owner_data['expense_category'].id, self.other_data['expense_category'].id),
            ('/api/budget/accounts/', self.owner_data['account'].id, self.other_data['account'].id),
            ('/api/budget/transactions/', self.owner_data['transaction'].id, self.other_data['transaction'].id),
            ('/api/budget/budgets/', self.owner_data['budget'].id, self.other_data['budget'].id),
            ('/api/budget/recurring-items/', self.owner_data['recurring_item'].id, self.other_data['recurring_item'].id),
        ]

        for url, owned_id, other_id in endpoints:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                returned_ids = {item['id'] for item in response.data}
                self.assertIn(owned_id, returned_ids)
                self.assertNotIn(other_id, returned_ids)

    def test_detail_endpoints_hide_other_users_records_by_id(self):
        self._authenticate(self.owner)

        endpoints = [
            f'/api/budget/category-groups/{self.other_data["expense_group"].id}/',
            f'/api/budget/categories/{self.other_data["expense_category"].id}/',
            f'/api/budget/accounts/{self.other_data["account"].id}/',
            f'/api/budget/transactions/{self.other_data["transaction"].id}/',
            f'/api/budget/budgets/{self.other_data["budget"].id}/',
            f'/api/budget/recurring-items/{self.other_data["recurring_item"].id}/',
        ]

        for url in endpoints:
            with self.subTest(method='GET', url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)
            with self.subTest(method='PATCH', url=url):
                self.assertEqual(self.client.patch(url, {'name': 'Hacked'}, format='json').status_code, status.HTTP_404_NOT_FOUND)
            with self.subTest(method='DELETE', url=url):
                self.assertEqual(self.client.delete(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_user_detail_attempts_do_not_mutate_or_delete_other_users_records(self):
        self._authenticate(self.owner)

        protected_account = self.other_data['account']
        response = self.client.patch(
            f'/api/budget/accounts/{protected_account.id}/',
            {'name': 'Compromised Account'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        protected_account.refresh_from_db()
        self.assertEqual(protected_account.name, 'Other Current Account')

        response = self.client.delete(f'/api/budget/accounts/{protected_account.id}/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Account.objects.filter(id=protected_account.id).exists())

    def test_user_cannot_create_category_with_another_users_group(self):
        self._authenticate(self.owner)

        response = self.client.post('/api/budget/categories/', {
            'group': self.other_data['expense_group'].id,
            'name': 'Unauthorized Category',
            'type': Category.TYPE_EXPENSE,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Category.objects.filter(user=self.owner, name='Unauthorized Category').exists())

    def test_user_cannot_create_transaction_with_another_users_account_or_category(self):
        self._authenticate(self.owner)

        invalid_payloads = [
            {
                'account': self.other_data['account'].id,
                'category': self.owner_data['expense_category'].id,
                'type': Transaction.TYPE_EXPENSE,
                'amount': '12.34',
                'date': '2026-06-10',
                'description': 'Invalid account',
            },
            {
                'account': self.owner_data['account'].id,
                'category': self.other_data['expense_category'].id,
                'type': Transaction.TYPE_EXPENSE,
                'amount': '12.34',
                'date': '2026-06-10',
                'description': 'Invalid category',
            },
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post('/api/budget/transactions/', payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_cannot_create_budget_with_another_users_category(self):
        self._authenticate(self.owner)

        response = self.client.post('/api/budget/budgets/', {
            'category': self.other_data['expense_category'].id,
            'month': '2026-07-01',
            'amount': '200.00',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Budget.objects.filter(user=self.owner, month=date(2026, 7, 1)).exists())

    def test_user_cannot_create_recurring_item_with_another_users_account_or_category(self):
        self._authenticate(self.owner)

        invalid_payloads = [
            {
                'account': self.other_data['account'].id,
                'category': self.owner_data['expense_category'].id,
                'name': 'Invalid account recurring item',
                'amount': '8.99',
                'frequency': RecurringItem.FREQUENCY_MONTHLY,
                'next_due_date': '2026-07-01',
                'type': RecurringItem.TYPE_SUBSCRIPTION,
            },
            {
                'account': self.owner_data['account'].id,
                'category': self.other_data['expense_category'].id,
                'name': 'Invalid category recurring item',
                'amount': '8.99',
                'frequency': RecurringItem.FREQUENCY_MONTHLY,
                'next_due_date': '2026-07-01',
                'type': RecurringItem.TYPE_SUBSCRIPTION,
            },
        ]

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                response = self.client.post('/api/budget/recurring-items/', payload, format='json')
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_summary_only_uses_current_users_transactions_budgets_and_recurring_items(self):
        self._authenticate(self.owner)

        response = self.client.get('/api/budget/summary/?month=2026-06')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['expense_total'], '25.00')
        self.assertEqual(response.data['budgeted_total'], '500.00')
        recent_transaction_ids = {item['id'] for item in response.data['recent_transactions']}
        upcoming_recurring_item_ids = {item['id'] for item in response.data['upcoming_recurring_items']}
        category_spending_category_ids = {item['category_id'] for item in response.data['category_spending']}

        self.assertIn(self.owner_data['transaction'].id, recent_transaction_ids)
        self.assertNotIn(self.other_data['transaction'].id, recent_transaction_ids)
        self.assertIn(self.owner_data['recurring_item'].id, upcoming_recurring_item_ids)
        self.assertNotIn(self.other_data['recurring_item'].id, upcoming_recurring_item_ids)
        self.assertIn(self.owner_data['expense_category'].id, category_spending_category_ids)
        self.assertNotIn(self.other_data['expense_category'].id, category_spending_category_ids)
