from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase

from .models import UserGroup, UserModuleAccess


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
