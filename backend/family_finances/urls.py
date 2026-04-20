from django.urls import path

from .views import (
    AllowanceEntryDetailView,
    AllowanceEntryListCreateView,
    CategoryComparisonView,
    ComparisonSummaryView,
    FamilyFinancesOverviewView,
    FamilyMemberDetailView,
    FamilyMemberListCreateView,
    PayerBreakdownView,
    SpendEntryDetailView,
    SpendEntryListCreateView,
)

urlpatterns = [
    path("", FamilyFinancesOverviewView.as_view(), name="family-finances-overview"),
    path("members/", FamilyMemberListCreateView.as_view(), name="family-member-list"),
    path("members/<int:pk>/", FamilyMemberDetailView.as_view(), name="family-member-detail"),
    path("allowances/", AllowanceEntryListCreateView.as_view(), name="family-allowance-list"),
    path("allowances/<int:pk>/", AllowanceEntryDetailView.as_view(), name="family-allowance-detail"),
    path("spend/", SpendEntryListCreateView.as_view(), name="family-spend-list"),
    path("spend/<int:pk>/", SpendEntryDetailView.as_view(), name="family-spend-detail"),
    path("comparison/summary/", ComparisonSummaryView.as_view(), name="family-comparison-summary"),
    path("comparison/payer-breakdown/", PayerBreakdownView.as_view(), name="family-comparison-payer-breakdown"),
    path("comparison/category/", CategoryComparisonView.as_view(), name="family-comparison-category"),
]
