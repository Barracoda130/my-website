from django.urls import path

from .views import (
    ExpenseCategoryDetailView,
    ExpenseCategoryListCreateView,
    ExpenseEntryDetailView,
    ExpenseEntryListCreateView,
    ExpenseSummaryView,
)

urlpatterns = [
    path("categories/", ExpenseCategoryListCreateView.as_view(), name="expense-category-list"),
    path("categories/<int:pk>/", ExpenseCategoryDetailView.as_view(), name="expense-category-detail"),
    path("entries/", ExpenseEntryListCreateView.as_view(), name="expense-entry-list"),
    path("entries/<int:pk>/", ExpenseEntryDetailView.as_view(), name="expense-entry-detail"),
    path("summary/", ExpenseSummaryView.as_view(), name="expense-summary"),
]
