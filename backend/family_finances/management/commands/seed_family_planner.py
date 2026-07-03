from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction

from family_finances.models import Child, Family, FamilyMembership, FamilyTransaction, TransactionChildSplit
from users.models import UserModuleAccess


def split_transaction(family_transaction, children):
    """Create equal child split rows for a seeded transaction."""
    share = (family_transaction.amount / Decimal(len(children))).quantize(Decimal('0.01'))
    percentage = (Decimal('100.00') / Decimal(len(children))).quantize(Decimal('0.01'))
    allocated = Decimal('0.00')

    for index, child in enumerate(children):
        amount = share
        if index == len(children) - 1:
            amount = family_transaction.amount - allocated
        TransactionChildSplit.objects.create(
            transaction=family_transaction,
            child=child,
            amount=amount,
            percentage=percentage,
        )
        allocated += amount


class Command(BaseCommand):
    help = 'Seed a demo family planner ledger with 4 children and example transactions.'

    def add_arguments(self, parser):
        parser.add_argument('--username', help='Optional username to link as the demo family admin.')

    @transaction.atomic
    def handle(self, *args, **options):
        username = options.get('username')
        user = User.objects.filter(username=username).first() if username else User.objects.first()

        family, _ = Family.objects.get_or_create(
            code='DEMO-FAMILY',
            defaults={'name': 'Demo Family', 'created_by': user},
        )
        family.name = 'Demo Family'
        if user and not family.created_by:
            family.created_by = user
        family.save()

        if user:
            FamilyMembership.objects.get_or_create(
                family=family,
                user=user,
                defaults={'role': FamilyMembership.ROLE_ADMIN},
            )
            UserModuleAccess.objects.get_or_create(
                user=user,
                module='family_finances',
                defaults={'granted_by': user if user.is_staff else None},
            )

        child_defs = [
            ('Alex', date(2012, 5, 14)),
            ('Beth', date(2014, 9, 2)),
            ('Charlie', date(2017, 1, 23)),
            ('Daisy', date(2019, 11, 8)),
        ]
        children = []
        for name, dob in child_defs:
            child, _ = Child.objects.get_or_create(
                family=family,
                name=name,
                defaults={'date_of_birth': dob, 'notes': 'Seeded demo child.'},
            )
            children.append(child)

        FamilyTransaction.objects.filter(family=family).delete()

        today = date.today()
        start_of_month = date(today.year, today.month, 1)
        start_of_year = date(today.year, 1, 1)

        seeded = [
            {
                'title': 'Weekly allowance - Alex',
                'date': today - timedelta(days=7),
                'amount': Decimal('10.00'),
                'type': FamilyTransaction.TYPE_ALLOWANCE,
                'category': FamilyTransaction.CATEGORY_ALLOWANCE,
                'paid_by': FamilyTransaction.PAID_BY_BOTH,
                'children': [children[0]],
                'recurring': True,
                'recurring_frequency': FamilyTransaction.FREQUENCY_WEEKLY,
                'recurring_start_date': start_of_year,
            },
            {
                'title': 'Monthly allowance - Beth',
                'date': start_of_month,
                'amount': Decimal('40.00'),
                'type': FamilyTransaction.TYPE_ALLOWANCE,
                'category': FamilyTransaction.CATEGORY_ALLOWANCE,
                'paid_by': FamilyTransaction.PAID_BY_BOTH,
                'children': [children[1]],
                'recurring': True,
                'recurring_frequency': FamilyTransaction.FREQUENCY_MONTHLY,
                'recurring_start_date': start_of_year,
            },
            {
                'title': 'New winter coat',
                'date': today - timedelta(days=15),
                'amount': Decimal('55.00'),
                'type': FamilyTransaction.TYPE_ONE_OFF,
                'category': FamilyTransaction.CATEGORY_CLOTHING,
                'paid_by': FamilyTransaction.PAID_BY_MUM,
                'children': [children[2]],
            },
            {
                'title': 'School trip contribution',
                'date': today - timedelta(days=35),
                'amount': Decimal('120.00'),
                'type': FamilyTransaction.TYPE_ONE_OFF,
                'category': FamilyTransaction.CATEGORY_EDUCATION,
                'paid_by': FamilyTransaction.PAID_BY_DAD,
                'children': [children[0]],
            },
            {
                'title': 'Laptop for homework',
                'date': today - timedelta(days=80),
                'amount': Decimal('650.00'),
                'type': FamilyTransaction.TYPE_LARGE,
                'category': FamilyTransaction.CATEGORY_TECHNOLOGY,
                'paid_by': FamilyTransaction.PAID_BY_BOTH,
                'children': [children[1]],
                'is_large_expense': True,
            },
            {
                'title': 'Shared family activity',
                'date': today - timedelta(days=12),
                'amount': Decimal('200.00'),
                'type': FamilyTransaction.TYPE_SHARED,
                'category': FamilyTransaction.CATEGORY_HOBBIES,
                'paid_by': FamilyTransaction.PAID_BY_BOTH,
                'children': children,
                'split_between_children': True,
            },
            {
                'title': 'Medical appointment - excluded',
                'date': today - timedelta(days=45),
                'amount': Decimal('85.00'),
                'type': FamilyTransaction.TYPE_EXCLUDED,
                'category': FamilyTransaction.CATEGORY_MEDICAL,
                'paid_by': FamilyTransaction.PAID_BY_BOTH,
                'children': [children[3]],
                'counts_toward_fairness': False,
                'notes': 'Excluded from fairness calculations.',
            },
            {
                'title': 'Recurring monthly allowance - Charlie',
                'date': start_of_month,
                'amount': Decimal('35.00'),
                'type': FamilyTransaction.TYPE_ALLOWANCE,
                'category': FamilyTransaction.CATEGORY_ALLOWANCE,
                'paid_by': FamilyTransaction.PAID_BY_BOTH,
                'children': [children[2]],
                'recurring': True,
                'recurring_frequency': FamilyTransaction.FREQUENCY_MONTHLY,
                'recurring_start_date': start_of_year,
            },
        ]

        for item in seeded:
            selected_children = item.pop('children')
            family_transaction = FamilyTransaction.objects.create(
                family=family,
                currency='GBP',
                counts_toward_fairness=item.pop('counts_toward_fairness', True),
                is_large_expense=item.pop('is_large_expense', False),
                split_between_children=item.pop('split_between_children', len(selected_children) > 1),
                recurring=item.pop('recurring', False),
                recurring_frequency=item.pop('recurring_frequency', FamilyTransaction.FREQUENCY_NONE),
                recurring_start_date=item.pop('recurring_start_date', None),
                recurring_end_date=item.pop('recurring_end_date', None),
                created_by=user,
                **item,
            )
            split_transaction(family_transaction, selected_children)

        self.stdout.write(self.style.SUCCESS(
            f'Seeded {family.name} with code {family.code}, {len(children)} children, and {len(seeded)} transactions.'
        ))