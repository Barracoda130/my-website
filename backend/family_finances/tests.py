from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from family_finances.models import Child, Family, FamilyTransaction, TransactionChildSplit
from family_finances.services.fairness import build_fairness_summary, totals_by_child
from family_finances.services.recurring import generate_recurring_instances


class FamilyFinanceServiceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='parent', password='test-password-123')
        self.family = Family.objects.create(name='Test Family', code='TEST123')
        self.alex = Child.objects.create(family=self.family, name='Alex')
        self.beth = Child.objects.create(family=self.family, name='Beth')

    def create_transaction(self, title, amount, children, **kwargs):
        tx = FamilyTransaction.objects.create(
            family=self.family,
            date=kwargs.pop('date', date(2026, 1, 1)),
            title=title,
            amount=Decimal(amount),
            type=kwargs.pop('type', FamilyTransaction.TYPE_ONE_OFF),
            category=kwargs.pop('category', FamilyTransaction.CATEGORY_OTHER),
            paid_by=FamilyTransaction.PAID_BY_BOTH,
            split_between_children=len(children) > 1,
            **kwargs,
        )
        share = (tx.amount / Decimal(len(children))).quantize(Decimal('0.01'))
        allocated = Decimal('0.00')
        for index, child in enumerate(children):
            split_amount = share if index < len(children) - 1 else tx.amount - allocated
            TransactionChildSplit.objects.create(
                transaction=tx,
                child=child,
                amount=split_amount,
                percentage=(Decimal('100.00') / Decimal(len(children))).quantize(Decimal('0.01')),
            )
            allocated += split_amount
        return tx

    def test_totals_use_child_split_amounts(self):
        self.create_transaction('Shared activity', '200.00', [self.alex, self.beth])

        totals = totals_by_child(self.family, counted_only=True)

        self.assertEqual(totals[self.alex.id], Decimal('100.00'))
        self.assertEqual(totals[self.beth.id], Decimal('100.00'))

    def test_fairness_excludes_non_counted_transactions(self):
        self.create_transaction('Allowance', '50.00', [self.alex], type=FamilyTransaction.TYPE_ALLOWANCE)
        self.create_transaction('Medical excluded', '75.00', [self.beth], counts_toward_fairness=False)

        summary = build_fairness_summary(self.family, today=date(2026, 6, 1))

        self.assertEqual(summary['total_counted_support'], Decimal('50.00'))
        alex_row = next(row for row in summary['children'] if row['child_id'] == self.alex.id)
        beth_row = next(row for row in summary['children'] if row['child_id'] == self.beth.id)
        self.assertEqual(alex_row['counted_total'], Decimal('50.00'))
        self.assertEqual(beth_row['counted_total'], Decimal('0.00'))
        self.assertEqual(beth_row['excluded_total'], Decimal('75.00'))

    def test_recurring_generation_avoids_duplicates(self):
        tx = self.create_transaction(
            'Weekly allowance',
            '10.00',
            [self.alex],
            date=date(2026, 1, 1),
            type=FamilyTransaction.TYPE_ALLOWANCE,
            category=FamilyTransaction.CATEGORY_ALLOWANCE,
            recurring=True,
            recurring_frequency=FamilyTransaction.FREQUENCY_WEEKLY,
            recurring_start_date=date(2026, 1, 1),
        )

        first = generate_recurring_instances(self.family, date(2026, 1, 22), created_by=self.user)
        second = generate_recurring_instances(self.family, date(2026, 1, 22), created_by=self.user)

        self.assertEqual(len(first), 3)
        self.assertEqual(len(second), 0)
        self.assertEqual(FamilyTransaction.objects.filter(generated_from=tx).count(), 3)