from datetime import timedelta

from django.db import transaction as db_transaction

from family_finances.models import FamilyTransaction, TransactionChildSplit


def add_month(value):
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    day = min(value.day, 28)
    return value.replace(year=year, month=month, day=day)


def next_occurrence(value, frequency):
    if frequency == FamilyTransaction.FREQUENCY_WEEKLY:
        return value + timedelta(days=7)
    if frequency == FamilyTransaction.FREQUENCY_MONTHLY:
        return add_month(value)
    if frequency == FamilyTransaction.FREQUENCY_YEARLY:
        return value.replace(year=value.year + 1)
    return None


def occurrence_dates(template, up_to_date):
    start = template.recurring_start_date or template.date
    end = template.recurring_end_date
    current = start
    dates = []
    while current and current <= up_to_date:
        if current != template.date and (not end or current <= end):
            dates.append(current)
        current = next_occurrence(current, template.recurring_frequency)
    return dates


@db_transaction.atomic
def generate_recurring_instances(family, up_to_date, *, created_by=None):
    """Generate recurring transaction instances without duplicating existing dates."""
    created = []
    templates = FamilyTransaction.objects.filter(
        family=family,
        recurring=True,
    ).exclude(recurring_frequency=FamilyTransaction.FREQUENCY_NONE).prefetch_related('splits')

    for template in templates:
        existing_dates = set(template.generated_instances.values_list('date', flat=True))
        for occurrence_date in occurrence_dates(template, up_to_date):
            if occurrence_date in existing_dates:
                continue
            instance = FamilyTransaction.objects.create(
                family=family,
                date=occurrence_date,
                title=f'{template.title} (recurring)',
                amount=template.amount,
                currency=template.currency,
                type=template.type,
                category=template.category,
                paid_by=template.paid_by,
                counts_toward_fairness=template.counts_toward_fairness,
                is_large_expense=template.is_large_expense,
                split_between_children=template.split_between_children,
                recurring=False,
                recurring_frequency=FamilyTransaction.FREQUENCY_NONE,
                notes=template.notes,
                receipt_url=template.receipt_url,
                generated_from=template,
                created_by=created_by,
            )
            for split in template.splits.all():
                TransactionChildSplit.objects.create(
                    transaction=instance,
                    child=split.child,
                    amount=split.amount,
                    percentage=split.percentage,
                )
            created.append(instance)
            existing_dates.add(occurrence_date)
    return created