from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase


class AuthenticationApiTests(APITestCase):
	def setUp(self):
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
