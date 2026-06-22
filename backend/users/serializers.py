from django.contrib.auth.models import User
from rest_framework import serializers
from .models import UserProfile, InviteToken, UserModuleAccess, UserGroup, AVAILABLE_MODULES


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['created_at']


class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'profile']


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    invite_token = serializers.UUIDField()

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("A user with that username already exists.")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})

        try:
            invite = InviteToken.objects.get(token=attrs['invite_token'])
        except InviteToken.DoesNotExist:
            raise serializers.ValidationError({"invite_token": "Invalid invite token."})

        if not invite.is_valid():
            raise serializers.ValidationError({"invite_token": "This invite token has expired or already been used."})

        attrs['invite'] = invite
        return attrs

    def create(self, validated_data):
        invite = validated_data.pop('invite')
        validated_data.pop('invite_token')
        validated_data.pop('password_confirm')

        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            email=validated_data.get('email', ''),
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )

        # Create profile
        UserProfile.objects.create(user=user)

        # Mark invite as used
        invite.is_used = True
        invite.used_by = user
        invite.save()

        return user


class UserModuleAccessSerializer(serializers.ModelSerializer):
    # Human-readable name for the module (e.g. "Budget Tracker" instead of "budget_tracker")
    module_display = serializers.SerializerMethodField()

    class Meta:
        model = UserModuleAccess
        fields = ['module', 'module_display', 'granted_at']

    def get_module_display(self, obj):
        return dict(AVAILABLE_MODULES).get(obj.module, obj.module)


class ValidateInviteSerializer(serializers.Serializer):
    invite_token = serializers.UUIDField()

    def validate_invite_token(self, value):
        try:
            invite = InviteToken.objects.get(token=value)
        except InviteToken.DoesNotExist:
            raise serializers.ValidationError("Invalid invite token.")
        if not invite.is_valid():
            raise serializers.ValidationError("This invite token has expired or already been used.")
        return value


class UserGroupSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)

    class Meta:
        model = UserGroup
        fields = ['id', 'name', 'members', 'created_at']
