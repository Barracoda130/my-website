import { apiRequest } from "../api/http";
import type {
  CreateExpenseBudgetPayload,
  CreateExpenseCategoryPayload,
  CreateExpenseEntryPayload,
  ExpenseBudget,
  ExpenseCategory,
  ExpenseEntry,
  ExpenseEntryFilters,
  ExpenseSummary,
  UpdateExpenseBudgetPayload,
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
  if (filters.entryType) {
    params.set("entry_type", filters.entryType);
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

export function listExpenseBudgets(): Promise<ExpenseBudget[]> {
  return apiRequest<ExpenseBudget[]>(`${EXPENSE_BASE}/budgets/`);
}

export function createExpenseBudget(payload: CreateExpenseBudgetPayload): Promise<ExpenseBudget> {
  return apiRequest<ExpenseBudget>(
    `${EXPENSE_BASE}/budgets/`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export function updateExpenseBudget(
  id: number,
  payload: UpdateExpenseBudgetPayload,
): Promise<ExpenseBudget> {
  return apiRequest<ExpenseBudget>(
    `${EXPENSE_BASE}/budgets/${id}/`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    true,
  );
}

export async function deleteExpenseBudget(id: number): Promise<void> {
  await apiRequest<void>(
    `${EXPENSE_BASE}/budgets/${id}/`,
    {
      method: "DELETE",
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
