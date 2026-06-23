from django.urls import path

from . import views

urlpatterns = [
    path('bootstrap-defaults/', views.bootstrap_defaults),
    path('summary/', views.summary),
    path('category-groups/', views.category_groups),
    path('category-groups/<int:pk>/', views.category_group_detail),
    path('categories/', views.categories),
    path('categories/<int:pk>/', views.category_detail),
    path('accounts/', views.accounts),
    path('accounts/<int:pk>/', views.account_detail),
    path('transactions/', views.transactions),
    path('transactions/<int:pk>/', views.transaction_detail),
    path('budgets/', views.budgets),
    path('budgets/<int:pk>/', views.budget_detail),
    path('recurring-items/', views.recurring_items),
    path('recurring-items/<int:pk>/', views.recurring_item_detail),
]
