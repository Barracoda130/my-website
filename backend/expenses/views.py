from datetime import date
from decimal import Decimal

from django.db.models import Count, Sum
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics, permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ExpenseCategory, ExpenseEntry
from .serializers import (
    ExpenseCategorySerializer,
    ExpenseEntrySerializer,
    ExpenseSummarySerializer,
)


DEFAULT_EXPENSE_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("Food", "#ef4444"),
    ("Transport", "#0ea5e9"),
    ("Housing", "#8b5cf6"),
    ("Utilities", "#f59e0b"),
    ("Entertainment", "#10b981"),
    ("Health", "#ec4899"),
)


def _ensure_default_categories(user) -> None:
    existing_names = set(
        ExpenseCategory.objects.filter(user=user).values_list("name", flat=True)
    )

    categories_to_create = [
        ExpenseCategory(user=user, name=name, color=color)
        for name, color in DEFAULT_EXPENSE_CATEGORIES
        if name not in existing_names
    ]

    if categories_to_create:
        ExpenseCategory.objects.bulk_create(categories_to_create)


def _parse_iso_date(raw_value: str | None, field_name: str) -> date | None:
    if not raw_value:
        return None

    try:
        return date.fromisoformat(raw_value)
    except ValueError as exc:
        raise serializers.ValidationError({field_name: "Expected date in YYYY-MM-DD format."}) from exc


def _filter_entries_for_request(request):
    queryset = ExpenseEntry.objects.filter(user=request.user)

    category_id = request.query_params.get("category")
    if category_id:
        try:
            queryset = queryset.filter(category_id=int(category_id))
        except ValueError as exc:
            raise serializers.ValidationError({"category": "Category must be an integer id."}) from exc

    from_date = _parse_iso_date(request.query_params.get("from"), "from")
    if from_date is not None:
        queryset = queryset.filter(spent_at__gte=from_date)

    to_date = _parse_iso_date(request.query_params.get("to"), "to")
    if to_date is not None:
        queryset = queryset.filter(spent_at__lte=to_date)

    return queryset


class ExpenseCategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ExpenseCategory.objects.none()

    def get_queryset(self):  # type: ignore[override]
        _ensure_default_categories(self.request.user)
        return ExpenseCategory.objects.filter(user=self.request.user).order_by("name")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ExpenseCategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseCategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ExpenseCategory.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return ExpenseCategory.objects.filter(user=self.request.user)


class ExpenseEntryListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ExpenseEntry.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return _filter_entries_for_request(self.request).select_related("category")

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ExpenseEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = ExpenseEntry.objects.none()

    def get_queryset(self):  # type: ignore[override]
        return ExpenseEntry.objects.filter(user=self.request.user).select_related("category")


class ExpenseSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter(name="from", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="to", type=str, required=False, location=OpenApiParameter.QUERY),
            OpenApiParameter(name="category", type=int, required=False, location=OpenApiParameter.QUERY),
        ],
        responses={200: ExpenseSummarySerializer},
    )
    def get(self, request):
        filtered_entries = _filter_entries_for_request(request)

        overall = filtered_entries.aggregate(
            total_amount=Sum("amount"),
            total_count=Count("id"),
        )

        by_category_queryset = filtered_entries.values("category_id", "category__name").annotate(
            total_amount=Sum("amount"),
            total_count=Count("id"),
        ).order_by("-total_amount")

        by_category = [
            {
                "category_id": row["category_id"],
                "category_name": row["category__name"] or "Uncategorized",
                "total_amount": row["total_amount"] or Decimal("0.00"),
                "total_count": row["total_count"],
            }
            for row in by_category_queryset
        ]

        data = {
            "total_amount": overall["total_amount"] or Decimal("0.00"),
            "total_count": overall["total_count"] or 0,
            "by_category": by_category,
        }

        serializer = ExpenseSummarySerializer(data)
        return Response(serializer.data)
