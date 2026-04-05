import { apiRequest } from "../api/http";
import type { AuthUser, LoginPayload } from "./types";

const AUTH_BASE = "/api/auth";

export async function bootstrapCsrf(): Promise<void> {
  await apiRequest<{ detail: string }>(`${AUTH_BASE}/csrf/`);
}

export async function login(payload: LoginPayload): Promise<AuthUser> {
  return apiRequest<AuthUser>(
    `${AUTH_BASE}/login/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
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
