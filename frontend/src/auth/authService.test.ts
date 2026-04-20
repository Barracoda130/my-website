import { beforeEach, describe, expect, it, vi } from "vitest";

import { bootstrapCsrf, getCurrentUser, login, logout } from "./authService";

describe("authService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "csrftoken=test-csrf-token",
    });
  });

  it("bootstraps CSRF cookie endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "CSRF cookie set.", csrf_token: "test-csrf-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await bootstrapCsrf();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/csrf/",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends CSRF header when logging in", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "CSRF cookie set.", csrf_token: "token-from-bootstrap" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, username: "testuser", email: "a@b.com", is_staff: false }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "CSRF cookie set.", csrf_token: "token-after-login" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await bootstrapCsrf();

    await login({ username: "testuser", password: "StrongPassword123!" });

    const [, options] = fetchMock.mock.calls[1];
    const headers = options?.headers as Headers;
    expect(headers.get("X-CSRFToken")).toBe("token-from-bootstrap");
    expect(options?.credentials).toBe("include");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("calls me endpoint for current user", async () => {
    const user = { id: 1, username: "testuser", email: "x@y.com", is_staff: false };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(user), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it("sends POST request for logout", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "Logged out." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/auth/logout/",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});
