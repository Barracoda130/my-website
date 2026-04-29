from django.contrib.auth import authenticate, login, logout
from datetime import timedelta
from django.middleware.csrf import get_token
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.csrf import ensure_csrf_cookie
from axes.conf import settings as axes_settings
from axes.handlers.proxy import AxesProxyHandler
from axes.helpers import get_client_ip_address, get_failure_limit
from axes.models import AccessAttempt
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import CsrfTokenSerializer, LoginSerializer, MessageSerializer, UserSerializer, UpdateEmailSerializer, ChangePasswordSerializer


def _cooloff_minutes() -> int:
	cooloff_value = axes_settings.AXES_COOLOFF_TIME
	if hasattr(cooloff_value, "total_seconds"):
		seconds = cooloff_value.total_seconds()
		return max(1, int(seconds // 60))

	try:
		# Integer cooloff values are configured in hours by django-axes.
		return max(1, int(float(cooloff_value) * 60))
	except (TypeError, ValueError):
		return 60


def _attempts_left_for_request(request, username: str) -> int:
	credentials = {"username": username}
	failure_limit = int(get_failure_limit(request, credentials) or 0)
	ip_address = get_client_ip_address(request)

	attempt = (
		AccessAttempt.objects.filter(username=username, ip_address=ip_address)
		.order_by("-attempt_time")
		.first()
	)

	if attempt is None:
		return failure_limit

	if axes_settings.AXES_COOLOFF_TIME:
		cooloff_minutes = _cooloff_minutes()
		threshold = timezone.now() - timedelta(minutes=cooloff_minutes)
		if attempt.attempt_time < threshold:
			return failure_limit

	return max(0, failure_limit - int(attempt.failures_since_start))


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
	permission_classes = [permissions.AllowAny]
	throttle_scope = "auth_csrf"

	@extend_schema(
		responses={status.HTTP_200_OK: CsrfTokenSerializer},
	)
	def get(self, request):
		csrf_token = get_token(request)
		return Response({"detail": "CSRF cookie set.", "csrf_token": csrf_token})


class LoginView(APIView):
	permission_classes = [permissions.AllowAny]
	throttle_scope = "auth_login"

	@method_decorator(csrf_protect)
	@extend_schema(
		request=LoginSerializer,
		responses={
			status.HTTP_200_OK: UserSerializer,
			status.HTTP_400_BAD_REQUEST: MessageSerializer,
		},
	)
	def post(self, request):
		serializer = LoginSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)
		username = serializer.validated_data["username"]
		credentials = {"username": username}

		user = authenticate(
			request,
			username=username,
			password=serializer.validated_data["password"],
		)
		if user is None:
			attempts_left = _attempts_left_for_request(request, username)
			locked_out = AxesProxyHandler.is_locked(request, credentials)
			response_data = {
				"detail": "Invalid username or password.",
				"attempts_left": attempts_left,
				"locked_out": locked_out,
			}

			if locked_out:
				response_data["lockout_minutes"] = _cooloff_minutes()
				response_data["detail"] = (
					"Too many failed login attempts. "
					f"Account locked for {response_data['lockout_minutes']} minute(s)."
				)

			return Response(
				response_data,
				status=status.HTTP_400_BAD_REQUEST,
			)

		login(request, user)
		return Response(UserSerializer(user).data, status=status.HTTP_200_OK)


class LogoutView(APIView):
	permission_classes = [permissions.IsAuthenticated]
	throttle_scope = "auth_logout"

	@method_decorator(csrf_protect)
	@extend_schema(
		request=None,
		responses={status.HTTP_200_OK: MessageSerializer},
	)
	def post(self, request):
		logout(request)
		return Response({"detail": "Logged out."}, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
	permission_classes = [permissions.IsAuthenticated]
	throttle_scope = "auth_me"

	@extend_schema(
		responses={status.HTTP_200_OK: UserSerializer},
	)
	def get(self, request):
		return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)

	@method_decorator(csrf_protect)
	@extend_schema(
		request=UpdateEmailSerializer,
		responses={
			status.HTTP_200_OK: UserSerializer,
			status.HTTP_400_BAD_REQUEST: MessageSerializer,
		},
	)
	def patch(self, request):
		serializer = UpdateEmailSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		request.user.email = serializer.validated_data["email"]
		request.user.save()

		return Response(UserSerializer(request.user).data, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
	permission_classes = [permissions.IsAuthenticated]
	throttle_scope = "auth_change_password"

	@method_decorator(csrf_protect)
	@extend_schema(
		request=ChangePasswordSerializer,
		responses={
			status.HTTP_200_OK: MessageSerializer,
			status.HTTP_400_BAD_REQUEST: MessageSerializer,
		},
	)
	def post(self, request):
		serializer = ChangePasswordSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		current_password = serializer.validated_data["current_password"]
		new_password = serializer.validated_data["new_password"]

		# Verify current password is correct
		if not request.user.check_password(current_password):
			return Response(
				{"detail": "Current password is incorrect."},
				status=status.HTTP_400_BAD_REQUEST,
			)

		# Set new password
		request.user.set_password(new_password)
		request.user.save()

		return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)
