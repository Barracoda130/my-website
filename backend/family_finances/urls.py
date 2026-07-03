from django.urls import path

from . import views

urlpatterns = [
    path('current/', views.current_family, name='family_current'),
    path('options/', views.options, name='family_options'),
    path('children/', views.children, name='family_children'),
    path('children/<int:child_id>/', views.child_detail, name='family_child_detail'),
    path('transactions/', views.transactions, name='family_transactions'),
    path('transactions/<int:transaction_id>/', views.transaction_detail, name='family_transaction_detail'),
    path('transactions/<int:transaction_id>/duplicate/', views.duplicate_transaction, name='family_transaction_duplicate'),
    path('dashboard/', views.dashboard, name='family_dashboard'),
    path('fairness/', views.fairness, name='family_fairness'),
    path('recurring/generate/', views.recurring_generate, name='family_recurring_generate'),
]
