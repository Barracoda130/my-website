from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import get_user_section_access


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    allowed_sections = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ["id", "username", "email", "is_staff", "allowed_sections"]

    def get_allowed_sections(self, obj):
        access = get_user_section_access(obj)
        return access.allowed_sections()


class MessageSerializer(serializers.Serializer):
    detail = serializers.CharField()


class CsrfTokenSerializer(serializers.Serializer):
    detail = serializers.CharField()
    csrf_token = serializers.CharField()
