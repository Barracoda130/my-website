from datetime import date
from decimal import Decimal
from calendar import monthrange
import uuid

from django.conf import settings
from django.db.models import Q, Sum
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import FamilyFinancesSectionPermission
from .models import AllowanceEntry, FamilyMember, SpendEntry, get_household_for_user
from .serializers import (
    AllowanceEntrySerializer,
    CategoryComparisonSerializer,
    FamilyComparisonSummarySerializer,
    FamilyMemberSerializer,
    PayerBreakdownSerializer,
    SpendEntrySerializer,
)


def _parse_iso_date(raw_value: str | None, field_name: str) -> date | None:
    if not raw_value:
        return None

    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise serializers.ValidationError({field_name: "Expected date in YYYY-MM-DD format."}) from exc


def _filter_allowances(request):
    queryset = AllowanceEntry.objects.filter(household=request.household).select_related("member")

    member_id = request.query_params.get("member")
    if member_id:
        try:
            queryset = queryset.filter(member_id=int(member_id))
        except ValueError as exc:
            raise serializers.ValidationError({"member": "Member must be an integer id."}) from exc

    from_date = _parse_iso_date(request.query_params.get("from"), "from")
    if from_date is not None:
        queryset = queryset.filter(received_at__gte=from_date)

    to_date = _parse_iso_date(request.query_params.get("to"), "to")
    if to_date is not None:
        queryset = queryset.filter(received_at__lte=to_date)

    return queryset


def _advance_allowance_date(current_date: date, interval: str) -> date:
    if interval == AllowanceEntry.RecurringInterval.WEEKLY:
        return current_date.fromordinal(current_date.toordinal() + 7)

    if interval == AllowanceEntry.RecurringInterval.MONTHLY:
        month = current_date.month + 1
        year = current_date.year
        if month > 12:
            month = 1
            year += 1
        day = min(current_date.day, monthrange(year, month)[1])
        return date(year, month, day)

    if interval == AllowanceEntry.RecurringInterval.YEARLY:
        year = current_date.year + 1
        day = min(current_date.day, monthrange(year, current_date.month)[1])
        return date(year, current_date.month, day)

    raise serializers.ValidationError({"recurring_interval": "Invalid recurring interval."})


def _build_allowance_schedule_dates(
    start_date: date,
    interval: str,
    end_date: date | None,
    payment_count: int | None,
) -> list[date]:
    dates: list[date] = []
    current_date = start_date
    sequence = 1

    while True:
        if payment_count is not None and sequence > payment_count:
            break
        if end_date is not None and current_date > end_date:
            break

        dates.append(current_date)
        current_date = _advance_allowance_date(current_date, interval)
        sequence += 1

    return dates


def _filter_spend(request):
    queryset = SpendEntry.objects.filter(household=request.household).select_related("member")

    member_id = request.query_params.get("member")
    if member_id:
        try:
            queryset = queryset.filter(member_id=int(member_id))
        except ValueError as exc:
            raise serializers.ValidationError({"member": "Member must be an integer id."}) from exc

    kind = request.query_params.get("kind")
    if kind:
        valid_kinds = {SpendEntry.Kind.SIGNIFICANT_PURCHASE, SpendEntry.Kind.HOLIDAY}
        if kind not in valid_kinds:
            raise serializers.ValidationError({"kind": "Invalid spend kind."})
        queryset = queryset.filter(kind=kind)

    payer = request.query_params.get("payer")
    if payer:
        valid_payers = {SpendEntry.Payer.PARENT, SpendEntry.Payer.CHILD}
        if payer not in valid_payers:
            raise serializers.ValidationError({"payer": "Invalid payer."})
        queryset = queryset.filter(payer=payer)

    from_date = _parse_iso_date(request.query_params.get("from"), "from")
    if from_date is not None:
        queryset = queryset.filter(spent_at__gte=from_date)

    to_date = _parse_iso_date(request.query_params.get("to"), "to")
    if to_date is not None:
        queryset = queryset.filter(spent_at__lte=to_date)

    significant_only = request.query_params.get("significant_only")
    if significant_only and significant_only.strip().lower() in {"1", "true", "yes", "on"}:
        threshold = Decimal(str(request.significant_threshold))
        queryset = queryset.filter(Q(manual_significant=True) | Q(amount__gte=threshold))

    return queryset


class FamilyFinancesBaseMixin:
    permission_classes = [permissions.IsAuthenticated, FamilyFinancesSectionPermission]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        request.household = get_household_for_user(request.user)
        request.significant_threshold = Decimal(str(settings.FAMILY_FINANCES_SIGNIFICANT_THRESHOLD))


class FamilyFinancesOverviewView(APIView):
    permission_classes = [permissions.IsAuthenticated, FamilyFinancesSectionPermission]

    def get(self, request):
        household = get_household_for_user(request.user)
        return Response(
            {
                "section": "family-finances",
                "message": "Family finances backend section is available.",
                "household": household.name,
            },
            status=status.HTTP_200_OK,
        )


class FamilyMemberListCreateView(FamilyFinancesBaseMixin, generics.ListCreateAPIView):
    serializer_class = FamilyMemberSerializer
    queryset = FamilyMember.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return FamilyMember.objects.filter(household=self.request.household).order_by("name")

    def perform_create(self, serializer):
        serializer.save(household=self.request.household)


class FamilyMemberDetailView(FamilyFinancesBaseMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = FamilyMemberSerializer
    queryset = FamilyMember.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return FamilyMember.objects.filter(household=self.request.household)


class AllowanceEntryListCreateView(FamilyFinancesBaseMixin, generics.ListCreateAPIView):
    serializer_class = AllowanceEntrySerializer
    queryset = AllowanceEntry.objects.none()

    @extend_schema(
        parameters=[
            OpenApiParameter(name="from", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="to", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="member", type=int, required=False, location=OpenApiParameter.QUERY),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):  # type: ignore[override]
        return _filter_allowances(self.request)

    def perform_create(self, serializer):
        data = serializer.validated_data
        is_recurring = bool(data.get("is_recurring"))

        if not is_recurring:
            serializer.save(
                household=self.request.household,
                created_by=self.request.user,
                recurrence_group_id=uuid.uuid4(),
                recurrence_sequence=1,
            )
            return

        group_id = uuid.uuid4()
        schedule_dates = _build_allowance_schedule_dates(
            start_date=data["received_at"],
            interval=data["recurring_interval"],
            end_date=data.get("recurring_end_date"),
            payment_count=data.get("recurring_payment_count"),
        )

        entries = [
            AllowanceEntry(
                household=self.request.household,
                member=data["member"],
                amount=data["amount"],
                received_at=scheduled_date,
                is_recurring=True,
                recurring_interval=data["recurring_interval"],
                recurring_end_date=data.get("recurring_end_date"),
                recurring_payment_count=data.get("recurring_payment_count"),
                recurrence_group_id=group_id,
                recurrence_sequence=index,
                notes=data.get("notes", ""),
                created_by=self.request.user,
            )
            for index, scheduled_date in enumerate(schedule_dates, start=1)
        ]

        created_entries = AllowanceEntry.objects.bulk_create(entries)
        serializer.instance = created_entries[0]


class AllowanceEntryDetailView(FamilyFinancesBaseMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AllowanceEntrySerializer
    queryset = AllowanceEntry.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return AllowanceEntry.objects.filter(household=self.request.household)


class SpendEntryListCreateView(FamilyFinancesBaseMixin, generics.ListCreateAPIView):
    serializer_class = SpendEntrySerializer
    queryset = SpendEntry.objects.none()

    @extend_schema(
        parameters=[
            OpenApiParameter(name="from", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="to", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="member", type=int, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="kind", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="payer", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="significant_only", type=bool, required=False, location=OpenApiParameter.QUERY),
        ],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):  # type: ignore[override]
        return _filter_spend(self.request)

    def perform_create(self, serializer):
        serializer.save(household=self.request.household, created_by=self.request.user)


class SpendEntryDetailView(FamilyFinancesBaseMixin, generics.RetrieveUpdateDestroyAPIView):
    serializer_class = SpendEntrySerializer
    queryset = SpendEntry.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return SpendEntry.objects.filter(household=self.request.household)


class ComparisonSummaryView(FamilyFinancesBaseMixin, APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(name="from", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="to", type=str, required=False, location=OpenApiParameter.QUERY),
        ],
        responses={status.HTTP_200_OK: FamilyComparisonSummarySerializer},
    )
    def get(self, request):
        members = FamilyMember.objects.filter(household=request.household).order_by("name")
        allowances = _filter_allowances(request)
        spend = _filter_spend(request)

        rows = []
        for member in members:
            member_allowance_total = allowances.filter(member=member).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            member_spend = spend.filter(member=member)

            purchase_spend = member_spend.filter(kind=SpendEntry.Kind.SIGNIFICANT_PURCHASE).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            holiday_spend = member_spend.filter(kind=SpendEntry.Kind.HOLIDAY).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            parent_paid_total = member_spend.filter(payer=SpendEntry.Payer.PARENT).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            child_paid_total = member_spend.filter(payer=SpendEntry.Payer.CHILD).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            rows.append(
                {
                    "member_id": member.id,
                    "member_name": member.name,
                    "allowance_received": member_allowance_total,
                    "purchase_spend": purchase_spend,
                    "holiday_spend": holiday_spend,
                    "parent_paid_total": parent_paid_total,
                    "child_paid_total": child_paid_total,
                    "net_position": member_allowance_total - child_paid_total,
                }
            )

        serializer = FamilyComparisonSummarySerializer({"members": rows})
        return Response(serializer.data, status=status.HTTP_200_OK)


class PayerBreakdownView(FamilyFinancesBaseMixin, APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(name="from", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="to", type=str, required=False, location=OpenApiParameter.QUERY),
        ],
        responses={status.HTTP_200_OK: PayerBreakdownSerializer},
    )
    def get(self, request):
        members = FamilyMember.objects.filter(household=request.household).order_by("name")
        spend = _filter_spend(request)

        rows = []
        overall_parent = Decimal("0.00")
        overall_child = Decimal("0.00")
        for member in members:
            member_spend = spend.filter(member=member)
            parent_paid_total = member_spend.filter(payer=SpendEntry.Payer.PARENT).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            child_paid_total = member_spend.filter(payer=SpendEntry.Payer.CHILD).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            overall_parent += parent_paid_total
            overall_child += child_paid_total
            rows.append(
                {
                    "member_id": member.id,
                    "member_name": member.name,
                    "parent_paid_total": parent_paid_total,
                    "child_paid_total": child_paid_total,
                }
            )

        serializer = PayerBreakdownSerializer(
            {
                "overall_parent_paid_total": overall_parent,
                "overall_child_paid_total": overall_child,
                "members": rows,
            }
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class CategoryComparisonView(FamilyFinancesBaseMixin, APIView):
    @extend_schema(
        parameters=[
            OpenApiParameter(name="from", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="to", type=str, required=False, location=OpenApiParameter.QUERY),
        ],
        responses={status.HTTP_200_OK: CategoryComparisonSerializer},
    )
    def get(self, request):
        members = FamilyMember.objects.filter(household=request.household).order_by("name")
        spend = _filter_spend(request)

        rows = []
        for member in members:
            member_spend = spend.filter(member=member)
            significant_purchase_total = member_spend.filter(kind=SpendEntry.Kind.SIGNIFICANT_PURCHASE).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            holiday_total = member_spend.filter(kind=SpendEntry.Kind.HOLIDAY).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

            rows.append(
                {
                    "member_id": member.id,
                    "member_name": member.name,
                    "significant_purchase_total": significant_purchase_total,
                    "holiday_total": holiday_total,
                }
            )

        serializer = CategoryComparisonSerializer({"members": rows})
        return Response(serializer.data, status=status.HTTP_200_OK)
