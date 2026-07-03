import csv
import io
import re
from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.db import transaction as db_transaction
from django.db.models.deletion import ProtectedError
from django.utils.dateparse import parse_date
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Account, Budget, Category, CategoryGroup, RecurringItem, Transaction
from .permissions import HasBudgetTrackerAccess
from .serializers import (
    AccountSerializer,
    BudgetSerializer,
    CategoryGroupSerializer,
    CategorySerializer,
    RecurringItemSerializer,
    TransactionSerializer,
)


def parse_month(month_value):
    """Parse YYYY-MM into first/last date for that month."""
    if not month_value:
        today = date.today()
        return date(today.year, today.month, 1)
    try:
        year, month = [int(part) for part in month_value.split('-')]
        return date(year, month, 1)
    except (TypeError, ValueError):
        return None


def month_end(month_start):
    return date(month_start.year, month_start.month, monthrange(month_start.year, month_start.month)[1])


def add_months(value, months):
    month_index = value.month - 1 + months
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, 1)


def planning_months(start_month):
    return [add_months(start_month, index) for index in range(12)]


def month_range(start_month, end_month):
    months = []
    current = start_month
    while current <= end_month:
        months.append(current)
        current = add_months(current, 1)
    return months


def serialize_decimal(value):
    return f'{value or Decimal("0.00"):.2f}'


STARLING_REQUIRED_HEADERS = {
    'Date',
    'Counter Party',
    'Reference',
    'Type',
    'Amount (GBP)',
    'Spending Category',
    'Notes',
}


def normalize_import_name(value):
    return re.sub(r'[^a-z0-9]+', '', (value or '').lower())


def display_import_category(value, fallback):
    cleaned = (value or '').strip()
    if not cleaned:
        return fallback
    return ' '.join(part.capitalize() for part in re.split(r'[_\s]+', cleaned) if part)


def get_import_group(user, category_type):
    if category_type == Category.TYPE_INCOME:
        group, _ = CategoryGroup.objects.get_or_create(
            user=user,
            name='Income',
            defaults={'type': CategoryGroup.TYPE_INCOME, 'sort_order': 0},
        )
        return group

    group, _ = CategoryGroup.objects.get_or_create(
        user=user,
        name='Imported',
        defaults={'type': CategoryGroup.TYPE_EXPENSE, 'sort_order': 80},
    )
    return group


def get_or_create_import_category(user, raw_name, category_type):
    fallback = 'Other Income' if category_type == Category.TYPE_INCOME else 'Imported'
    display_name = display_import_category(raw_name, fallback)
    normalized_display = normalize_import_name(display_name)
    for category in Category.objects.filter(user=user, type=category_type, is_archived=False):
        if normalize_import_name(category.name) == normalized_display or normalize_import_name(category.name) == normalize_import_name(raw_name):
            return category, False

    group = get_import_group(user, category_type)
    category, created = Category.objects.get_or_create(
        user=user,
        group=group,
        name=display_name,
        defaults={
            'type': category_type,
            'color': '#16a34a' if category_type == Category.TYPE_INCOME else '#64748b',
            'icon': '➕' if category_type == Category.TYPE_INCOME else '📥',
        },
    )
    return category, created


def parse_starling_date(value):
    try:
        day, month, year = [int(part) for part in (value or '').split('/')]
        return date(year, month, day)
    except (TypeError, ValueError):
        return None


def build_import_notes(row):
    notes = ['Imported from CSV.']
    bank_type = (row.get('Type') or '').strip()
    csv_notes = (row.get('Notes') or '').strip()
    if bank_type:
        notes.append(f'Bank type: {bank_type}.')
    if csv_notes:
        notes.append(f'CSV notes: {csv_notes}')
    return ' '.join(notes)


def create_default_setup(user):
    """Create starter groups, categories, and an account for first-time users."""
    group_defs = [
        ('Income', CategoryGroup.TYPE_INCOME, 0),
        ('Housing', CategoryGroup.TYPE_EXPENSE, 10),
        ('Food', CategoryGroup.TYPE_EXPENSE, 20),
        ('Transport', CategoryGroup.TYPE_EXPENSE, 30),
        ('Bills', CategoryGroup.TYPE_EXPENSE, 40),
        ('Subscriptions', CategoryGroup.TYPE_EXPENSE, 50),
        ('Lifestyle', CategoryGroup.TYPE_EXPENSE, 60),
        ('Other', CategoryGroup.TYPE_MIXED, 90),
    ]
    groups = {}
    for name, group_type, sort_order in group_defs:
        group, _ = CategoryGroup.objects.get_or_create(
            user=user,
            name=name,
            defaults={'type': group_type, 'sort_order': sort_order},
        )
        groups[name] = group

    category_defs = [
        ('Salary', 'Income', Category.TYPE_INCOME, '💷', '#16a34a'),
        ('Other Income', 'Income', Category.TYPE_INCOME, '➕', '#22c55e'),
        ('Rent/Mortgage', 'Housing', Category.TYPE_EXPENSE, '🏠', '#2563eb'),
        ('Groceries', 'Food', Category.TYPE_EXPENSE, '🛒', '#f97316'),
        ('Eating Out', 'Food', Category.TYPE_EXPENSE, '🍽️', '#fb923c'),
        ('Fuel', 'Transport', Category.TYPE_EXPENSE, '⛽', '#0ea5e9'),
        ('Public Transport', 'Transport', Category.TYPE_EXPENSE, '🚌', '#38bdf8'),
        ('Utilities', 'Bills', Category.TYPE_EXPENSE, '💡', '#eab308'),
        ('Phone/Internet', 'Bills', Category.TYPE_EXPENSE, '📱', '#a855f7'),
        ('Streaming', 'Subscriptions', Category.TYPE_EXPENSE, '🎬', '#ec4899'),
        ('Entertainment', 'Lifestyle', Category.TYPE_EXPENSE, '🎟️', '#8b5cf6'),
        ('Shopping', 'Lifestyle', Category.TYPE_EXPENSE, '🛍️', '#f43f5e'),
        ('Miscellaneous', 'Other', Category.TYPE_EXPENSE, '📦', '#64748b'),
    ]
    for index, (name, group_name, category_type, icon, color) in enumerate(category_defs):
        Category.objects.get_or_create(
            user=user,
            group=groups[group_name],
            name=name,
            defaults={'type': category_type, 'icon': icon, 'color': color, 'sort_order': index},
        )

    Account.objects.get_or_create(
        user=user,
        name='Current Account',
        defaults={'type': Account.TYPE_CURRENT, 'opening_balance': Decimal('0.00')},
    )


@api_view(['POST'])
@permission_classes([HasBudgetTrackerAccess])
def bootstrap_defaults(request):
    create_default_setup(request.user)
    return Response({
        'category_groups': CategoryGroupSerializer(CategoryGroup.objects.filter(user=request.user), many=True).data,
        'categories': CategorySerializer(Category.objects.filter(user=request.user), many=True).data,
        'accounts': AccountSerializer(Account.objects.filter(user=request.user), many=True).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([HasBudgetTrackerAccess])
def import_transactions_csv(request):
    upload = request.FILES.get('file')
    account_id = request.data.get('account')

    if not upload:
        return Response({'file': 'Upload a CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        account = Account.objects.get(id=account_id, user=request.user)
    except (Account.DoesNotExist, TypeError, ValueError):
        return Response({'account': 'Choose a valid account.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        decoded = upload.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return Response({'file': 'CSV file must be UTF-8 encoded.'}, status=status.HTTP_400_BAD_REQUEST)

    reader = csv.DictReader(io.StringIO(decoded))
    headers = set(reader.fieldnames or [])
    missing_headers = sorted(STARLING_REQUIRED_HEADERS - headers)
    if missing_headers:
        return Response({'file': f'Missing required CSV columns: {", ".join(missing_headers)}.'}, status=status.HTTP_400_BAD_REQUEST)

    created_transactions = []
    created_category_ids = set()
    skipped_duplicates = 0
    errors = []

    with db_transaction.atomic():
        for row_number, row in enumerate(reader, start=2):
            transaction_date = parse_starling_date(row.get('Date'))
            if not transaction_date:
                errors.append({'row': row_number, 'date': 'Date must use DD/MM/YYYY.'})
                continue

            try:
                signed_amount = Decimal((row.get('Amount (GBP)') or '').strip())
            except Exception:
                errors.append({'row': row_number, 'amount': 'Amount must be a valid number.'})
                continue

            if signed_amount == 0:
                errors.append({'row': row_number, 'amount': 'Amount cannot be zero.'})
                continue

            transaction_type = Transaction.TYPE_INCOME if signed_amount > 0 else Transaction.TYPE_EXPENSE
            amount = abs(signed_amount)
            category, category_created = get_or_create_import_category(
                request.user,
                row.get('Spending Category'),
                transaction_type,
            )
            if category_created:
                created_category_ids.add(category.id)

            payee = (row.get('Counter Party') or '').strip()
            reference = (row.get('Reference') or '').strip()
            description = reference or payee or category.name
            notes = build_import_notes(row)

            duplicate_exists = Transaction.objects.filter(
                user=request.user,
                account=account,
                category=category,
                type=transaction_type,
                amount=amount,
                date=transaction_date,
                payee=payee,
                description=description,
            ).exists()
            if duplicate_exists:
                skipped_duplicates += 1
                continue

            created_transactions.append(Transaction.objects.create(
                user=request.user,
                account=account,
                category=category,
                type=transaction_type,
                amount=amount,
                date=transaction_date,
                description=description,
                payee=payee,
                notes=notes,
            ))

        if errors:
            db_transaction.set_rollback(True)
            return Response({'rows': errors}, status=status.HTTP_400_BAD_REQUEST)

    return Response({
        'created_transactions': len(created_transactions),
        'created_categories': len(created_category_ids),
        'skipped_duplicates': skipped_duplicates,
        'transactions': TransactionSerializer(created_transactions, many=True).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([HasBudgetTrackerAccess])
def summary(request):
    month_start = parse_month(request.query_params.get('month'))
    if not month_start:
        return Response({'detail': 'Invalid month. Use YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)
    month_finish = month_end(month_start)

    transactions = Transaction.objects.filter(user=request.user, date__gte=month_start, date__lte=month_finish)
    income_total = transactions.filter(type=Transaction.TYPE_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    expense_total = transactions.filter(type=Transaction.TYPE_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    expected_income_total = Budget.objects.filter(user=request.user, month=month_start, category__type=Category.TYPE_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
    budgeted_total = Budget.objects.filter(user=request.user, month=month_start, category__type=Category.TYPE_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    budgets_for_month = Budget.objects.filter(user=request.user, month=month_start, category__type=Category.TYPE_EXPENSE).select_related('category')
    category_spending = []
    for budget in budgets_for_month:
        spent = transactions.filter(type=Transaction.TYPE_EXPENSE, category=budget.category).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        category_spending.append({
            'category_id': budget.category.id,
            'category_name': budget.category.name,
            'category_color': budget.category.color,
            'budgeted': serialize_decimal(budget.amount),
            'spent': serialize_decimal(spent),
            'remaining': serialize_decimal(budget.amount - spent),
        })

    upcoming_until = date.today() + timedelta(days=45)
    upcoming = RecurringItem.objects.filter(
        user=request.user,
        is_active=True,
        next_due_date__lte=upcoming_until,
    ).select_related('account', 'category')[:10]

    return Response({
        'month': month_start.strftime('%Y-%m'),
        'income_total': serialize_decimal(income_total),
        'expected_income_total': serialize_decimal(expected_income_total),
        'expense_total': serialize_decimal(expense_total),
        'net_total': serialize_decimal(income_total - expense_total),
        'budgeted_total': serialize_decimal(budgeted_total),
        'remaining_budget': serialize_decimal(budgeted_total - expense_total),
        'category_spending': category_spending,
        'recent_transactions': TransactionSerializer(transactions.select_related('account', 'category')[:8], many=True).data,
        'upcoming_recurring_items': RecurringItemSerializer(upcoming, many=True).data,
    })


@api_view(['GET'])
@permission_classes([HasBudgetTrackerAccess])
def reports(request):
    start_month = parse_month(request.query_params.get('start'))
    end_month = parse_month(request.query_params.get('end'))
    if not start_month or not end_month:
        return Response({'detail': 'Invalid range. Use start=YYYY-MM and end=YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)
    if start_month > end_month:
        return Response({'detail': 'Start month must be before or equal to end month.'}, status=status.HTTP_400_BAD_REQUEST)

    months = month_range(start_month, end_month)
    if len(months) > 24:
        return Response({'detail': 'Report range cannot exceed 24 months.'}, status=status.HTTP_400_BAD_REQUEST)

    range_end = month_end(end_month)
    transactions = Transaction.objects.filter(
        user=request.user,
        date__gte=start_month,
        date__lte=range_end,
    ).select_related('category')
    budgets = Budget.objects.filter(
        user=request.user,
        month__in=months,
    ).select_related('category')

    monthly_totals = []
    for month in months:
        finish = month_end(month)
        month_transactions = transactions.filter(date__gte=month, date__lte=finish)
        income_total = month_transactions.filter(type=Transaction.TYPE_INCOME).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        expense_total = month_transactions.filter(type=Transaction.TYPE_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        budgeted_total = budgets.filter(month=month, category__type=Category.TYPE_EXPENSE).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        monthly_totals.append({
            'month': month.strftime('%Y-%m'),
            'income_total': serialize_decimal(income_total),
            'expense_total': serialize_decimal(expense_total),
            'net_total': serialize_decimal(income_total - expense_total),
            'budgeted_total': serialize_decimal(budgeted_total),
            'remaining_budget': serialize_decimal(budgeted_total - expense_total),
        })

    category_totals = []
    category_rows = transactions.filter(type=Transaction.TYPE_EXPENSE, category__isnull=False).values(
        'category_id',
        'category__name',
        'category__color',
    ).annotate(total=Sum('amount')).order_by('-total')
    for row in category_rows:
        category_totals.append({
            'category_id': row['category_id'],
            'category_name': row['category__name'],
            'category_color': row['category__color'],
            'spent': serialize_decimal(row['total']),
        })

    daily_expense_totals = []
    daily_rows = transactions.filter(type=Transaction.TYPE_EXPENSE).values('date').annotate(total=Sum('amount')).order_by('date')
    for row in daily_rows:
        daily_expense_totals.append({
            'date': row['date'].isoformat(),
            'spent': serialize_decimal(row['total']),
        })

    payee_totals = []
    payee_rows = transactions.filter(type=Transaction.TYPE_EXPENSE).exclude(payee='').values('payee').annotate(total=Sum('amount')).order_by('-total')[:5]
    for row in payee_rows:
        payee_totals.append({
            'payee': row['payee'],
            'spent': serialize_decimal(row['total']),
        })

    return Response({
        'start': start_month.strftime('%Y-%m'),
        'end': end_month.strftime('%Y-%m'),
        'months': [month.strftime('%Y-%m') for month in months],
        'monthly_totals': monthly_totals,
        'category_totals': category_totals,
        'daily_expense_totals': daily_expense_totals,
        'top_payees': payee_totals,
    })


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def yearly_plan(request):
    if request.method == 'GET':
        start_month = parse_month(request.query_params.get('start'))
        if not start_month:
            return Response({'detail': 'Invalid start month. Use YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)

        months = planning_months(start_month)
        groups = CategoryGroup.objects.filter(user=request.user, is_archived=False).prefetch_related('categories')
        categories = Category.objects.filter(user=request.user, is_archived=False).select_related('group')
        budgets = Budget.objects.filter(user=request.user, month__in=months).select_related('category')
        recurring = RecurringItem.objects.filter(user=request.user, is_active=True).select_related('account', 'category')

        return Response({
            'start': start_month.strftime('%Y-%m'),
            'months': [month.strftime('%Y-%m') for month in months],
            'month_dates': [month.isoformat() for month in months],
            'category_groups': CategoryGroupSerializer(groups, many=True).data,
            'categories': CategorySerializer(categories, many=True).data,
            'budgets': BudgetSerializer(budgets, many=True).data,
            'recurring_items': RecurringItemSerializer(recurring, many=True).data,
        })

    start_month = parse_month(request.data.get('start'))
    if not start_month:
        return Response({'detail': 'Invalid start month. Use YYYY-MM.'}, status=status.HTTP_400_BAD_REQUEST)

    valid_months = set(planning_months(start_month))
    budget_items = request.data.get('budgets', [])
    if not isinstance(budget_items, list):
        return Response({'budgets': 'Expected a list of budget items.'}, status=status.HTTP_400_BAD_REQUEST)

    saved = []
    errors = []
    with db_transaction.atomic():
        for index, item in enumerate(budget_items):
            category_id = item.get('category')
            month_value = parse_date(item.get('month', ''))
            amount = item.get('amount')

            if not month_value or month_value.day != 1 or month_value not in valid_months:
                errors.append({'index': index, 'month': 'Month must be the first day of a month in the selected 12-month plan.'})
                continue

            try:
                category = Category.objects.get(id=category_id, user=request.user, type__in=[Category.TYPE_INCOME, Category.TYPE_EXPENSE])
            except Category.DoesNotExist:
                errors.append({'index': index, 'category': 'Invalid income or expense category.'})
                continue

            try:
                amount_decimal = Decimal(str(amount))
            except Exception:
                errors.append({'index': index, 'amount': 'Enter a valid amount.'})
                continue

            if amount_decimal <= 0:
                Budget.objects.filter(user=request.user, category=category, month=month_value).delete()
                continue

            budget, _ = Budget.objects.update_or_create(
                user=request.user,
                category=category,
                month=month_value,
                defaults={'amount': amount_decimal},
            )
            saved.append(budget)

        if errors:
            db_transaction.set_rollback(True)
            return Response({'budgets': errors}, status=status.HTTP_400_BAD_REQUEST)

    return Response({'saved': BudgetSerializer(saved, many=True).data})


def collection_view(request, queryset, serializer_class):
    if request.method == 'GET':
        return Response(serializer_class(queryset.filter(user=request.user), many=True).data)
    serializer = serializer_class(data=request.data, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def detail_view(request, queryset, serializer_class, pk):
    instance = get_object_or_404(queryset, pk=pk, user=request.user)
    if request.method == 'GET':
        return Response(serializer_class(instance).data)
    if request.method == 'DELETE':
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = serializer_class(instance, data=request.data, partial=True, context={'request': request})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def category_groups(request):
    return collection_view(request, CategoryGroup.objects.all(), CategoryGroupSerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasBudgetTrackerAccess])
def category_group_detail(request, pk):
    if request.method == 'DELETE':
        group = get_object_or_404(CategoryGroup.objects.all(), pk=pk, user=request.user)
        categories = Category.objects.filter(user=request.user, group=group)
        try:
            with db_transaction.atomic():
                Budget.objects.filter(user=request.user, category__in=categories).delete()
                categories.delete()
                group.delete()
        except ProtectedError:
            return Response(
                {'detail': 'This group has categories linked to transactions or recurring items. Remove those links before deleting the group.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    return detail_view(request, CategoryGroup.objects.all(), CategoryGroupSerializer, pk)


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def categories(request):
    return collection_view(request, Category.objects.select_related('group'), CategorySerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasBudgetTrackerAccess])
def category_detail(request, pk):
    return detail_view(request, Category.objects.select_related('group'), CategorySerializer, pk)


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def accounts(request):
    return collection_view(request, Account.objects.all(), AccountSerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasBudgetTrackerAccess])
def account_detail(request, pk):
    return detail_view(request, Account.objects.all(), AccountSerializer, pk)


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def transactions(request):
    queryset = Transaction.objects.select_related('account', 'category')
    month_start = parse_month(request.query_params.get('month')) if request.query_params.get('month') else None
    if request.method == 'GET' and month_start:
        queryset = queryset.filter(date__gte=month_start, date__lte=month_end(month_start))
    return collection_view(request, queryset, TransactionSerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasBudgetTrackerAccess])
def transaction_detail(request, pk):
    return detail_view(request, Transaction.objects.select_related('account', 'category'), TransactionSerializer, pk)


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def budgets(request):
    queryset = Budget.objects.select_related('category')
    month_start = parse_month(request.query_params.get('month')) if request.query_params.get('month') else None
    if request.method == 'GET' and month_start:
        queryset = queryset.filter(month=month_start)
    return collection_view(request, queryset, BudgetSerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasBudgetTrackerAccess])
def budget_detail(request, pk):
    return detail_view(request, Budget.objects.select_related('category'), BudgetSerializer, pk)


@api_view(['GET', 'POST'])
@permission_classes([HasBudgetTrackerAccess])
def recurring_items(request):
    return collection_view(request, RecurringItem.objects.select_related('account', 'category'), RecurringItemSerializer)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasBudgetTrackerAccess])
def recurring_item_detail(request, pk):
    return detail_view(request, RecurringItem.objects.select_related('account', 'category'), RecurringItemSerializer, pk)
