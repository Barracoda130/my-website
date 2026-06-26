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


def serialize_decimal(value):
    return f'{value or Decimal("0.00"):.2f}'


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
