from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from . import views

urlpatterns = [
    # JWT login (returns access + refresh tokens)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    # Refresh an expired access token using the refresh token
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    # Invite-only registration
    path('invite/validate/', views.validate_invite, name='validate_invite'),
    path('register/', views.register, name='register'),
    # Logout (blacklists the refresh token)
    path('logout/', views.logout, name='logout'),
    # Current user info
    path('me/', views.me, name='me'),
    path('me/modules/', views.my_modules, name='my_modules'),
    path('me/groups/', views.my_groups, name='my_groups'),
]
