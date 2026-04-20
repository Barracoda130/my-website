import { apiRequest, setCsrfToken } from "../api/http";
import type { AuthUser, LoginPayload } from "./types";

const AUTH_BASE = "/api/auth";

export async function bootstrapCsrf(): Promise<void> {
  const response = await apiRequest<{ detail: string; csrf_token?: string }>(`${AUTH_BASE}/csrf/`);
  setCsrfToken(response.csrf_token ?? null);
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  const user = await apiRequest<AuthUser>(
    `${AUTH_BASE}/login/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );

  // Django rotates the CSRF token on successful login.
  await bootstrapCsrf();
  return user;
}

export async function logout(): Promise<void> {
  await apiRequest<{ detail: string }>(
    `${AUTH_BASE}/logout/`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
    true,
  );
}

export async function getCurrentUser(): Promise<AuthUser> {
  return apiRequest<AuthUser>(`${AUTH_BASE}/me/`);
}
