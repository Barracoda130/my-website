from django.urls import path

from .views import CsrfTokenView, CurrentUserView, LoginView, LogoutView, ChangePasswordView

urlpatterns = [
    path("csrf/", CsrfTokenView.as_view(), name="auth-csrf"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", CurrentUserView.as_view(), name="auth-me"),
    path("change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]
