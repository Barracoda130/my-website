from typing import cast
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserModuleAccess, UserGroup
from .serializers import (
    RegisterSerializer,
    UserSerializer,
    UserModuleAccessSerializer,
    ValidateInviteSerializer,
    UserGroupSerializer,
)


class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_scope = 'login'


class ThrottledTokenRefreshView(TokenRefreshView):
    throttle_scope = 'token_refresh'


class ScopedIPRateThrottle(SimpleRateThrottle):
    """Apply a named throttle scope to unauthenticated public endpoints by IP."""

    scope = None

    def get_cache_key(self, request, view):
        if self.scope is None:
            return None
        return self.cache_format % {
            'scope': self.scope,
            'ident': self.get_ident(request),
        }


class InviteValidateRateThrottle(ScopedIPRateThrottle):
    scope = 'invite_validate'


class RegisterRateThrottle(ScopedIPRateThrottle):
    scope = 'register'


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([InviteValidateRateThrottle])
def validate_invite(request):
    """
    Check whether an invite token is valid before showing the registration form.
    POST /api/auth/invite/validate/
    Body: { "invite_token": "<uuid>" }
    """
    serializer = ValidateInviteSerializer(data=request.data)
    if serializer.is_valid():
        return Response({'valid': True})
    return Response({'valid': False, 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([RegisterRateThrottle])
def register(request):
    """
    Register a new user using a valid invite token.
    POST /api/auth/register/
    Body: { "username", "password", "password_confirm", "invite_token", "email"(opt), "first_name"(opt), "last_name"(opt) }
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = cast(User, serializer.save())
        # Issue JWT tokens immediately so the user is logged in after registering
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Blacklist the refresh token to log the user out.
    POST /api/auth/logout/
    Body: { "refresh": "<refresh_token>" }
    """
    try:
        refresh_token = request.data.get('refresh')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'detail': 'Successfully logged out.'})
    except Exception:
        return Response({'detail': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    Return the currently authenticated user's data.
    GET /api/auth/me/
    """
    return Response(UserSerializer(request.user).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_modules(request):
    """
    Return the list of modules the current user has access to.
    GET /api/auth/me/modules/
    """
    access_records = UserModuleAccess.objects.filter(user=request.user)
    serializer = UserModuleAccessSerializer(access_records, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def my_groups(request):
    """
    Return the list of UserGroups the current user belongs to.
    GET /api/auth/me/groups/
    """
    groups = UserGroup.objects.filter(members=request.user)
    serializer = UserGroupSerializer(groups, many=True)
    return Response(serializer.data)
