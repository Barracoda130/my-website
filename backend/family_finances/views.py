from datetime import date

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .models import Child, FamilyMembership, FamilyTransaction
from .permissions import HasFamilyFinancesAccess
from .serializers import ChildSerializer, FamilyMembershipSerializer, FamilyTransactionSerializer
from .services.fairness import build_fairness_summary, dashboard_totals, serialize_money
from .services.recurring import generate_recurring_instances


def current_membership(user):
    return FamilyMembership.objects.select_related('family').filter(user=user, family__is_active=True).first()


def current_family_or_response(request):
    membership = current_membership(request.user)
    if not membership:
        return None, Response({'detail': 'You are not linked to an active family.'}, status=status.HTTP_404_NOT_FOUND)
    membership.family.ensure_default_child()
    return membership.family, None


def money_dict(values):
    return {key: serialize_money(value) for key, value in values.items()}


def serialize_fairness(summary):
    def row(item):
        if not item:
            return None
        return {
            **item,
            'counted_total': serialize_money(item['counted_total']),
            'all_time_total': serialize_money(item['all_time_total']),
            'difference_from_average': serialize_money(item['difference_from_average']),
            'gap_to_highest': serialize_money(item['gap_to_highest']),
            'allowance_total': serialize_money(item['allowance_total']),
            'extra_expense_total': serialize_money(item['extra_expense_total']),
            'large_expense_total': serialize_money(item['large_expense_total']),
            'excluded_total': serialize_money(item['excluded_total']),
            'rolling_12_month_total': serialize_money(item['rolling_12_month_total']),
            'category_totals': {key: serialize_money(value) for key, value in item['category_totals'].items()},
        }

    return {
        'family_average': serialize_money(summary['family_average']),
        'total_counted_support': serialize_money(summary['total_counted_support']),
        'highest_supported_child': row(summary['highest_supported_child']),
        'lowest_supported_child': row(summary['lowest_supported_child']),
        'largest_fairness_gap': serialize_money(summary['largest_fairness_gap']),
        'children': [row(item) for item in summary['children']],
    }


@api_view(['GET'])
@permission_classes([HasFamilyFinancesAccess])
def current_family(request):
    membership = current_membership(request.user)
    if not membership:
        return Response({'detail': 'You are not linked to an active family.'}, status=status.HTTP_404_NOT_FOUND)
    membership.family.ensure_default_child()
    return Response(FamilyMembershipSerializer(membership).data)


@api_view(['GET'])
@permission_classes([HasFamilyFinancesAccess])
def options(request):
    def choices(values):
        return [{'value': value, 'label': label} for value, label in values]

    return Response({
        'transaction_types': choices(FamilyTransaction.TYPE_CHOICES),
        'categories': choices(FamilyTransaction.CATEGORY_CHOICES),
        'paid_by': choices(FamilyTransaction.PAID_BY_CHOICES),
        'recurring_frequencies': choices(FamilyTransaction.FREQUENCY_CHOICES),
    })


@api_view(['GET', 'POST'])
@permission_classes([HasFamilyFinancesAccess])
def children(request):
    family, error = current_family_or_response(request)
    if error:
        return error
    if request.method == 'GET':
        return Response(ChildSerializer(Child.objects.filter(family=family), many=True).data)
    serializer = ChildSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(family=family)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasFamilyFinancesAccess])
def child_detail(request, child_id):
    family, error = current_family_or_response(request)
    if error:
        return error
    child = get_object_or_404(Child, id=child_id, family=family)
    if request.method == 'GET':
        return Response(ChildSerializer(child).data)
    if request.method == 'DELETE':
        child.active = False
        child.save()
        return Response(ChildSerializer(child).data)
    serializer = ChildSerializer(child, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([HasFamilyFinancesAccess])
def transactions(request):
    family, error = current_family_or_response(request)
    if error:
        return error
    queryset = FamilyTransaction.objects.filter(family=family).prefetch_related('splits__child')
    if request.method == 'GET':
        child = request.query_params.get('child')
        start = parse_date(request.query_params.get('start') or '')
        end = parse_date(request.query_params.get('end') or '')
        if child:
            queryset = queryset.filter(splits__child_id=child)
        if start:
            queryset = queryset.filter(date__gte=start)
        if end:
            queryset = queryset.filter(date__lte=end)
        for field in ['type', 'category']:
            value = request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        if request.query_params.get('counts_toward_fairness') in ['true', 'false']:
            queryset = queryset.filter(counts_toward_fairness=request.query_params['counts_toward_fairness'] == 'true')
        if request.query_params.get('recurring') == 'true':
            queryset = queryset.filter(recurring=True)
        if request.query_params.get('large') == 'true':
            queryset = queryset.filter(is_large_expense=True)
        return Response(FamilyTransactionSerializer(queryset.distinct(), many=True).data)
    serializer = FamilyTransactionSerializer(data=request.data, context={'request': request, 'family': family})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([HasFamilyFinancesAccess])
def transaction_detail(request, transaction_id):
    family, error = current_family_or_response(request)
    if error:
        return error
    transaction = get_object_or_404(FamilyTransaction, id=transaction_id, family=family)
    if request.method == 'GET':
        return Response(FamilyTransactionSerializer(transaction).data)
    if request.method == 'DELETE':
        transaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = FamilyTransactionSerializer(transaction, data=request.data, partial=True, context={'request': request, 'family': family})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([HasFamilyFinancesAccess])
def duplicate_transaction(request, transaction_id):
    family, error = current_family_or_response(request)
    if error:
        return error
    original = get_object_or_404(FamilyTransaction.objects.prefetch_related('splits'), id=transaction_id, family=family)
    data = FamilyTransactionSerializer(original).data
    data.pop('id', None)
    data['title'] = f"{original.title} (copy)"
    serializer = FamilyTransactionSerializer(data=data, context={'request': request, 'family': family})
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([HasFamilyFinancesAccess])
def dashboard(request):
    family, error = current_family_or_response(request)
    if error:
        return error
    summary = dashboard_totals(family)
    data = serialize_fairness(summary)
    data.update({
        'this_month': money_dict(summary['this_month']),
        'this_year': money_dict(summary['this_year']),
        'all_time': money_dict(summary['all_time']),
    })
    return Response(data)


@api_view(['GET'])
@permission_classes([HasFamilyFinancesAccess])
def fairness(request):
    family, error = current_family_or_response(request)
    if error:
        return error
    return Response(serialize_fairness(build_fairness_summary(family)))


@api_view(['POST'])
@permission_classes([HasFamilyFinancesAccess])
def recurring_generate(request):
    family, error = current_family_or_response(request)
    if error:
        return error
    up_to_date = parse_date(request.data.get('up_to_date') or '') or date.today()
    created = generate_recurring_instances(family, up_to_date, created_by=request.user)
    return Response({'created': len(created), 'transactions': FamilyTransactionSerializer(created, many=True).data})
