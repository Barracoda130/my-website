from collections import defaultdict
from datetime import date
from decimal import Decimal

from django.db.models import Prefetch

from family_finances.models import Child, FamilyTransaction, TransactionChildSplit


ZERO = Decimal('0.00')


def month_bounds(value=None):
    value = value or date.today()
    start = date(value.year, value.month, 1)
    if value.month == 12:
        end = date(value.year + 1, 1, 1)
    else:
        end = date(value.year, value.month + 1, 1)
    return start, end


def year_bounds(value=None):
    value = value or date.today()
    return date(value.year, 1, 1), date(value.year + 1, 1, 1)


def rolling_12_month_start(value=None):
    value = value or date.today()
    return date(value.year - 1, value.month, value.day)


def date_filter(queryset, start_date=None, end_date=None):
    if start_date:
        queryset = queryset.filter(transaction__date__gte=start_date)
    if end_date:
        queryset = queryset.filter(transaction__date__lt=end_date)
    return queryset


def active_children(family):
    return list(Child.objects.filter(family=family, active=True).order_by('name'))


def split_queryset(family, *, counted_only=False, start_date=None, end_date=None):
    queryset = TransactionChildSplit.objects.select_related('child', 'transaction').filter(
        transaction__family=family,
        child__family=family,
    )
    if counted_only:
        queryset = queryset.filter(transaction__counts_toward_fairness=True)
    return date_filter(queryset, start_date=start_date, end_date=end_date)


def totals_by_child(family, *, counted_only=False, start_date=None, end_date=None):
    """
    Sum support per child from TransactionChildSplit rows.

    This is the core fairness rule: child totals are based on each child's stored
    split amount, not the parent transaction amount. A £200 transaction split
    across 4 children therefore contributes £50 to each child.
    """
    totals = {child.id: ZERO for child in active_children(family)}
    for split in split_queryset(family, counted_only=counted_only, start_date=start_date, end_date=end_date):
        if split.child_id in totals:
            totals[split.child_id] += split.amount
    return totals


def category_totals_by_child(family, *, counted_only=False, start_date=None, end_date=None):
    totals = defaultdict(lambda: defaultdict(lambda: ZERO))
    for split in split_queryset(family, counted_only=counted_only, start_date=start_date, end_date=end_date):
        totals[split.child_id][split.transaction.category] += split.amount
    return totals


def type_totals_by_child(family, *, start_date=None, end_date=None):
    totals = defaultdict(lambda: defaultdict(lambda: ZERO))
    for split in split_queryset(family, start_date=start_date, end_date=end_date):
        totals[split.child_id][split.transaction.type] += split.amount
    return totals


def excluded_totals_by_child(family, *, start_date=None, end_date=None):
    totals = {child.id: ZERO for child in active_children(family)}
    queryset = split_queryset(family, counted_only=False, start_date=start_date, end_date=end_date).filter(
        transaction__counts_toward_fairness=False
    )
    for split in queryset:
        if split.child_id in totals:
            totals[split.child_id] += split.amount
    return totals


def large_expense_totals_by_child(family, *, start_date=None, end_date=None):
    totals = {child.id: ZERO for child in active_children(family)}
    queryset = split_queryset(family, counted_only=False, start_date=start_date, end_date=end_date).filter(
        transaction__is_large_expense=True
    )
    for split in queryset:
        if split.child_id in totals:
            totals[split.child_id] += split.amount
    return totals


def serialize_money(value):
    return f'{(value or ZERO):.2f}'


def build_fairness_summary(family, *, today=None):
    """
    Build the family fairness comparison.

    Fairness totals include only transactions where counts_toward_fairness=True.
    Excluded transactions remain visible separately, but do not affect average,
    difference-from-average, or gap-to-highest calculations.
    """
    today = today or date.today()
    children = active_children(family)
    counted_totals = totals_by_child(family, counted_only=True)
    all_time_totals = totals_by_child(family)
    excluded_totals = excluded_totals_by_child(family)
    large_totals = large_expense_totals_by_child(family)
    type_totals = type_totals_by_child(family)
    category_totals = category_totals_by_child(family)
    rolling_totals = totals_by_child(family, counted_only=True, start_date=rolling_12_month_start(today), end_date=today)

    active_count = len(children) or 1
    total_counted_support = sum(counted_totals.values(), ZERO)
    family_average = (total_counted_support / Decimal(active_count)).quantize(Decimal('0.01'))
    highest_total = max(counted_totals.values(), default=ZERO)
    lowest_total = min(counted_totals.values(), default=ZERO)

    child_rows = []
    for child in children:
        counted_total = counted_totals.get(child.id, ZERO)
        difference_from_average = counted_total - family_average
        gap_to_highest = highest_total - counted_total
        child_type_totals = type_totals.get(child.id, {})
        child_rows.append({
            'child_id': child.id,
            'child_name': child.name,
            'counted_total': counted_total,
            'all_time_total': all_time_totals.get(child.id, ZERO),
            'difference_from_average': difference_from_average,
            'gap_to_highest': gap_to_highest,
            'allowance_total': child_type_totals.get(FamilyTransaction.TYPE_ALLOWANCE, ZERO),
            'extra_expense_total': (
                child_type_totals.get(FamilyTransaction.TYPE_ONE_OFF, ZERO)
                + child_type_totals.get(FamilyTransaction.TYPE_SHARED, ZERO)
                + child_type_totals.get(FamilyTransaction.TYPE_OTHER, ZERO)
            ),
            'large_expense_total': large_totals.get(child.id, ZERO),
            'excluded_total': excluded_totals.get(child.id, ZERO),
            'rolling_12_month_total': rolling_totals.get(child.id, ZERO),
            'category_totals': dict(category_totals.get(child.id, {})),
        })

    highest_child = max(child_rows, key=lambda row: row['counted_total'], default=None)
    lowest_child = min(child_rows, key=lambda row: row['counted_total'], default=None)

    return {
        'family_average': family_average,
        'total_counted_support': total_counted_support,
        'highest_supported_child': highest_child,
        'lowest_supported_child': lowest_child,
        'largest_fairness_gap': highest_total - lowest_total,
        'children': child_rows,
    }


def dashboard_totals(family, *, today=None):
    today = today or date.today()
    month_start, month_end = month_bounds(today)
    year_start, year_end = year_bounds(today)
    fairness = build_fairness_summary(family, today=today)

    return {
        **fairness,
        'this_month': totals_by_child(family, counted_only=True, start_date=month_start, end_date=month_end),
        'this_year': totals_by_child(family, counted_only=True, start_date=year_start, end_date=year_end),
        'all_time': totals_by_child(family, counted_only=True),
    }


def recent_transactions_for_child(child, limit=5):
    splits = TransactionChildSplit.objects.select_related('transaction').filter(child=child).order_by(
        '-transaction__date', '-transaction__created_at'
    )[:limit]
    return [split.transaction for split in splits]


def transactions_for_child(child):
    return FamilyTransaction.objects.filter(splits__child=child).prefetch_related(
        Prefetch('splits', queryset=TransactionChildSplit.objects.select_related('child'))
    ).distinct()