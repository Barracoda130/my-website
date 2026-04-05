import { apiRequest } from "../api/http";
import type {
  CreateExpenseCategoryPayload,
  CreateExpenseEntryPayload,
  ExpenseCategory,
  ExpenseEntry,
  ExpenseEntryFilters,
  ExpenseSummary,
} from "./types";

const EXPENSE_BASE = "/api/expenses";

function buildQueryParams(filters: ExpenseEntryFilters): string {
  const params = new URLSearchParams();

  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.category) {
    params.set("category", String(filters.category));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return apiRequest<ExpenseCategory[]>(`${EXPENSE_BASE}/categories/`);
}

export function createExpenseCategory(
  payload: CreateExpenseCategoryPayload,
): Promise<ExpenseCategory> {
  return apiRequest<ExpenseCategory>(
    `${EXPENSE_BASE}/categories/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function listExpenseEntries(filters: ExpenseEntryFilters = {}): Promise<ExpenseEntry[]> {
  return apiRequest<ExpenseEntry[]>(`${EXPENSE_BASE}/entries/${buildQueryParams(filters)}`);
}

export function createExpenseEntry(payload: CreateExpenseEntryPayload): Promise<ExpenseEntry> {
  return apiRequest<ExpenseEntry>(
    `${EXPENSE_BASE}/entries/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteExpenseEntry(id: number): Promise<void> {
  await apiRequest<void>(
    `${EXPENSE_BASE}/entries/${id}/`,
    {
      method: "DELETE",
    },
    true,
  );
}

export function getExpenseSummary(filters: ExpenseEntryFilters = {}): Promise<ExpenseSummary> {
  return apiRequest<ExpenseSummary>(`${EXPENSE_BASE}/summary/${buildQueryParams(filters)}`);
}
