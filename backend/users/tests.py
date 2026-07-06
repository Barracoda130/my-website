from django.contrib.auth.models import User
from django.db import IntegrityError
from rest_framework import status
from rest_framework.test import APITestCase

from family_finances.models import Family, FamilyMembership

from .models import InviteToken, InviteTokenModuleAccess, UserGroup, UserModuleAccess


class UserEndpointSecurityTests(APITestCase):
    """Security tests for current-user auth endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(username='user', password='test-password-123')
        self.other_user = User.objects.create_user(username='other', password='test-password-123')
        self.admin = User.objects.create_user(username='admin', password='test-password-123')

        UserModuleAccess.objects.create(user=self.user, module='budget_tracker', granted_by=self.admin)
        UserModuleAccess.objects.create(user=self.other_user, module='family_finances', granted_by=self.admin)

        self.users_group = UserGroup.objects.create(name='Users group', created_by=self.admin)
        self.users_group.members.add(self.user)
        self.other_group = UserGroup.objects.create(name='Other group', created_by=self.admin)
        self.other_group.members.add(self.other_user)

    def test_current_user_endpoints_require_authentication(self):
        endpoints = [
            '/api/auth/me/',
            '/api/auth/me/modules/',
            '/api/auth/me/groups/',
            '/api/auth/logout/',
        ]

        for url in endpoints:
            with self.subTest(url=url):
                response = self.client.get(url) if url != '/api/auth/logout/' else self.client.post(url, {})
                self.assertIn(response.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_me_only_returns_authenticated_users_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/auth/me/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], self.user.id)
        self.assertEqual(response.data['username'], self.user.username)
        self.assertNotEqual(response.data['id'], self.other_user.id)

    def test_my_modules_only_returns_authenticated_users_module_grants(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/auth/me/modules/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_modules = {item['module'] for item in response.data}
        self.assertEqual(returned_modules, {'budget_tracker'})
        self.assertNotIn('family_finances', returned_modules)

    def test_my_groups_only_returns_groups_for_authenticated_user(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get('/api/auth/me/groups/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_group_ids = {item['id'] for item in response.data}
        self.assertIn(self.users_group.id, returned_group_ids)
        self.assertNotIn(self.other_group.id, returned_group_ids)


class InviteRegistrationModulePresetTests(APITestCase):
    """Registration tests for invite-level predefined module access."""

    def setUp(self):
        self.admin = User.objects.create_user(username='admin', password='test-password-123')

    def register_with_invite(self, invite, username='invited-user', extra_data=None):
        payload = {
            'username': username,
            'password': 'test-password-123',
            'password_confirm': 'test-password-123',
            'invite_token': str(invite.token),
        }
        if extra_data:
            payload.update(extra_data)
        return self.client.post('/api/auth/register/', payload, format='json')

    def test_registering_with_invite_grants_preset_module_access(self):
        invite = InviteToken.objects.create(created_by=self.admin)
        InviteTokenModuleAccess.objects.create(invite=invite, module='budget_tracker')

        response = self.register_with_invite(invite)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='invited-user')
        self.assertTrue(UserModuleAccess.objects.filter(user=user, module='budget_tracker').exists())

    def test_registering_with_invite_grants_multiple_preset_modules(self):
        invite = InviteToken.objects.create(created_by=self.admin)
        InviteTokenModuleAccess.objects.create(invite=invite, module='budget_tracker')
        InviteTokenModuleAccess.objects.create(invite=invite, module='family_finances')

        response = self.register_with_invite(invite)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='invited-user')
        granted_modules = set(UserModuleAccess.objects.filter(user=user).values_list('module', flat=True))
        self.assertEqual(granted_modules, {'budget_tracker', 'family_finances'})

    def test_invite_module_presets_are_unique_per_invite(self):
        invite = InviteToken.objects.create(created_by=self.admin)

        InviteTokenModuleAccess.objects.create(invite=invite, module='budget_tracker')

        with self.assertRaises(IntegrityError):
            InviteTokenModuleAccess.objects.create(invite=invite, module='budget_tracker')

    def test_family_code_registration_still_works_with_invite_presets(self):
        family = Family.objects.create(name='Test Family', code='TEST-FAMILY', created_by=self.admin)
        invite = InviteToken.objects.create(created_by=self.admin)
        InviteTokenModuleAccess.objects.create(invite=invite, module='budget_tracker')

        response = self.register_with_invite(
            invite,
            extra_data={'family_code': 'TEST-FAMILY'},
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username='invited-user')
        self.assertTrue(FamilyMembership.objects.filter(family=family, user=user).exists())
        granted_modules = set(UserModuleAccess.objects.filter(user=user).values_list('module', flat=True))
        self.assertEqual(granted_modules, {'budget_tracker', 'family_finances'})
