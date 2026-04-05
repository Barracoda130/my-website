export type EntryType = "expense" | "income";

export interface ExpenseCategory {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface ExpenseEntry {
  id: number;
  title: string;
  notes: string;
  entry_type: EntryType;
  amount: string;
  spent_at: string;
  category: number | null;
  category_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseSummaryCategory {
  category_id: number | null;
  category_name: string;
  total_amount: string;
  total_count: number;
}

export interface ExpenseSummary {
  total_amount: string;
  total_count: number;
  by_category: ExpenseSummaryCategory[];
}

export interface CreateExpenseCategoryPayload {
  name: string;
  color?: string;
}

export interface CreateExpenseEntryPayload {
  title: string;
  notes?: string;
  entry_type?: EntryType;
  amount: string;
  spent_at: string;
  category?: number | null;
}

export interface ExpenseEntryFilters {
  from?: string;
  to?: string;
  category?: number;
  entryType?: EntryType;
}
