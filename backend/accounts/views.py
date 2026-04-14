from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer, MessageSerializer, UserSerializer


@method_decorator(ensure_csrf_cookie, name="dispatch")
class CsrfTokenView(APIView):
	permission_classes = [permissions.AllowAny]
	throttle_scope = "auth_csrf"

	@extend_schema(
		responses={status.HTTP_200_OK: MessageSerializer},
	)
	def get(self, request):
		return Response({"detail": "CSRF cookie set."})


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

		user = authenticate(
			request,
			username=serializer.validated_data["username"],
			password=serializer.validated_data["password"],
		)
		if user is None:
			return Response(
				{"detail": "Invalid username or password."},
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
