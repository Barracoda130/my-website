from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.urls import reverse
from django.test import override_settings
from unittest.mock import patch
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .throttles import WindowScopedRateThrottle


class AuthenticationApiTests(APITestCase):
	def setUp(self):
		cache.clear()
		self.username = "testuser"
		self.password = "StrongPassword123!"
		self.user = get_user_model().objects.create_user(
			username=self.username,
			password=self.password,
			email="test@example.com",
		)

		self.csrf_url = reverse("auth-csrf")
		self.login_url = reverse("auth-login")
		self.logout_url = reverse("auth-logout")
		self.me_url = reverse("auth-me")

		self.client = APIClient(enforce_csrf_checks=True)

	def _get_csrf_token(self):
		response = self.client.get(self.csrf_url)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("csrftoken", response.cookies)
		return response.cookies["csrftoken"].value

	def _login(self):
		csrf_token = self._get_csrf_token()
		response = self.client.post(
			self.login_url,
			{"username": self.username, "password": self.password},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		return self.client.cookies["csrftoken"].value if "csrftoken" in self.client.cookies else csrf_token

	def test_csrf_endpoint_sets_csrf_cookie(self):
		response = self.client.get(self.csrf_url)
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertIn("csrftoken", response.cookies)

	def test_login_rejects_request_without_csrf(self):
		response = self.client.post(
			self.login_url,
			{"username": self.username, "password": self.password},
			format="json",
		)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_login_returns_400_for_invalid_credentials(self):
		csrf_token = self._get_csrf_token()
		response = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

	def test_login_and_me_success(self):
		self._login()
		response = self.client.get(self.me_url)

		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.data["username"], self.username)

	def test_me_requires_authentication(self):
		response = self.client.get(self.me_url)
		self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

	def test_logout_invalidates_session(self):
		csrf_token = self._login()
		logout_response = self.client.post(
			self.logout_url,
			{},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

		me_response = self.client.get(self.me_url)
		self.assertEqual(me_response.status_code, status.HTTP_403_FORBIDDEN)

	def test_healthz_is_public_and_returns_ok(self):
		response = self.client.get("/healthz/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.json()["status"], "ok")

	def test_healthz_without_trailing_slash_returns_ok(self):
		response = self.client.get("/healthz")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.json()["status"], "ok")

	def test_readyz_is_public_and_reports_database_state(self):
		response = self.client.get("/readyz/")
		self.assertEqual(response.status_code, status.HTTP_200_OK)
		self.assertEqual(response.json()["status"], "ok")
		self.assertEqual(response.json()["database"], "reachable")

	@patch.dict(
		WindowScopedRateThrottle.THROTTLE_RATES,
		{
			"auth_login": "2/minute",
			"auth_csrf": "2/minute",
			"auth_logout": "2/minute",
			"auth_me": "2/minute",
		},
		clear=False,
	)
	def test_login_is_rate_limited(self):
		cache.clear()
		csrf_token = self._get_csrf_token()

		first = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		second = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
		)
		third = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
		)

		self.assertEqual(first.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(third.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

	@patch.dict(
		WindowScopedRateThrottle.THROTTLE_RATES,
		{
			"auth_login": "2/minute",
			"auth_csrf": "2/minute",
			"auth_logout": "2/minute",
			"auth_me": "2/minute",
		},
		clear=False,
	)
	def test_csrf_endpoint_is_rate_limited(self):
		cache.clear()

		first = self.client.get(self.csrf_url)
		second = self.client.get(self.csrf_url)
		third = self.client.get(self.csrf_url)

		self.assertEqual(first.status_code, status.HTTP_200_OK)
		self.assertEqual(second.status_code, status.HTTP_200_OK)
		self.assertEqual(third.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

	@override_settings(
		AXES_ENABLED=True,
		AXES_FAILURE_LIMIT=2,
		AXES_COOLOFF_TIME=1,
	)
	def test_login_locks_out_after_repeated_failures_for_username_and_ip(self):
		cache.clear()
		csrf_token = self._get_csrf_token()

		first = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
			REMOTE_ADDR="10.0.0.8",
		)
		second = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
			REMOTE_ADDR="10.0.0.8",
		)
		third = self.client.post(
			self.login_url,
			{"username": self.username, "password": "wrong-password"},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
			REMOTE_ADDR="10.0.0.8",
		)
		blocked = self.client.post(
			self.login_url,
			{"username": self.username, "password": self.password},
			format="json",
			HTTP_X_CSRFTOKEN=csrf_token,
			REMOTE_ADDR="10.0.0.8",
		)

		self.assertEqual(first.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
		self.assertIn(third.status_code, {status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN})
		self.assertIn(blocked.status_code, {status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN})


class AdminBootstrapCommandTests(APITestCase):
	def test_ensure_admin_account_creates_superuser_from_env(self):
		with patch.dict(
			"os.environ",
			{
				"ADMIN_USERNAME": "admin",
				"ADMIN_EMAIL": "admin@example.com",
				"ADMIN_PASSWORD": "StrongPassword123!",
			},
			clear=False,
		):
			call_command("ensure_admin_account")

		user = get_user_model().objects.get(username="admin")
		self.assertEqual(user.email, "admin@example.com")
		self.assertTrue(user.is_staff)
		self.assertTrue(user.is_superuser)
		self.assertTrue(user.check_password("StrongPassword123!"))

	def test_ensure_admin_account_updates_existing_user(self):
		user = get_user_model().objects.create_user(
			username="admin",
			email="old@example.com",
			password="OldPassword123!",
		)
		user.is_staff = False
		user.is_superuser = False
		user.save()

		with patch.dict(
			"os.environ",
			{
				"ADMIN_USERNAME": "admin",
				"ADMIN_EMAIL": "new@example.com",
				"ADMIN_PASSWORD": "NewPassword123!",
			},
			clear=False,
		):
			call_command("ensure_admin_account")

		user.refresh_from_db()
		self.assertEqual(user.email, "new@example.com")
		self.assertTrue(user.is_staff)
		self.assertTrue(user.is_superuser)
		self.assertTrue(user.check_password("NewPassword123!"))
