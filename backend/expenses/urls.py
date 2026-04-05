from django.urls import path

from .views import (
    ExpenseBudgetDetailView,
    ExpenseBudgetListCreateView,
    ExpenseCategoryDetailView,
    ExpenseCategoryListCreateView,
    ExpenseEntryDetailView,
    ExpenseEntryListCreateView,
    ExpenseSummaryView,
)

urlpatterns = [
    path("categories/", ExpenseCategoryListCreateView.as_view(), name="expense-category-list"),
    path("categories/<int:pk>/", ExpenseCategoryDetailView.as_view(), name="expense-category-detail"),
    path("budgets/", ExpenseBudgetListCreateView.as_view(), name="expense-budget-list"),
    path("budgets/<int:pk>/", ExpenseBudgetDetailView.as_view(), name="expense-budget-detail"),
    path("entries/", ExpenseEntryListCreateView.as_view(), name="expense-entry-list"),
    path("entries/<int:pk>/", ExpenseEntryDetailView.as_view(), name="expense-entry-detail"),
    path("summary/", ExpenseSummaryView.as_view(), name="expense-summary"),
]
