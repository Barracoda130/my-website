import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createExpenseEntry,
  getExpenseSummary,
  listExpenseEntries,
} from "./expenseService";

describe("expenseService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "csrftoken=test-csrf-token",
    });
  });

  it("applies query params when listing entries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await listExpenseEntries({
      from: "2026-04-01",
      to: "2026-04-30",
      category: 3,
      entryType: "income",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/expenses/entries/?from=2026-04-01&to=2026-04-30&category=3&entry_type=income",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("sends CSRF header when creating entry", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          title: "Lunch",
          notes: "",
          amount: "12.50",
          spent_at: "2026-04-01",
          category: null,
          category_name: null,
          created_at: "2026-04-01T10:00:00Z",
          updated_at: "2026-04-01T10:00:00Z",
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await createExpenseEntry({
      title: "Lunch",
      amount: "12.50",
      spent_at: "2026-04-01",
      notes: "",
      category: null,
    });

    const [, options] = fetchMock.mock.calls[0];
    const headers = options?.headers as Headers;
    expect(headers.get("X-CSRFToken")).toBe("test-csrf-token");
    expect(options?.method).toBe("POST");
  });

  it("requests summary endpoint", async () => {
    const summary = {
      total_amount: "92.25",
      total_count: 3,
      by_category: [],
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(summary), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getExpenseSummary({ from: "2026-04-01" })).resolves.toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/expenses/summary/?from=2026-04-01",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
