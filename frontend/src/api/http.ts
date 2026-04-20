const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
let csrfTokenOverride: string | null = null;

export class ApiRequestError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.data = data;
  }
}

export function buildApiUrl(path: string): string {
  if (path.startsWith("http")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export function getCookieValue(name: string): string | null {
  const escapedName = name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1");
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setCsrfToken(token: string | null): void {
  csrfTokenOverride = token;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  includeCsrf = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (includeCsrf) {
    const csrfToken = csrfTokenOverride ?? getCookieValue("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await response.json()) as Record<string, unknown>;
      const detail = typeof data.detail === "string" ? data.detail : null;
      throw new ApiRequestError(detail ?? `Request failed with status ${response.status}`, response.status, data);
    }

    const text = await response.text();
    throw new ApiRequestError(text || `Request failed with status ${response.status}`, response.status, null);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
