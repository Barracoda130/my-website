import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import { ApiRequestError } from "../api/http";
import LoginForm from "../auth/components/LoginForm";
import { bootstrapCsrf, getCurrentUser, login, logout } from "../auth/authService";
import type { AuthUser } from "../auth/types";
import {
  createExpenseBudget,
  createExpenseCategory,
  createExpenseEntry,
  deleteExpenseBudget,
  deleteExpenseEntry,
  getExpenseSummary,
  listExpenseBudgets,
  listExpenseCategories,
  listExpenseEntries,
  updateExpenseBudget,
} from "./expenseService";
import type {
  EntryType,
  ExpenseBudget,
  ExpenseCategory,
  ExpenseEntry,
  ExpenseEntryFilters,
  ExpenseSummary,
} from "./types";
import BudgetSetupPanel from "./components/BudgetSetupPanel";
import CreateCategoryForm from "./components/CreateCategoryForm";
import ExpenseAnalyticsPanel from "./components/ExpenseAnalyticsPanel";
import CreateExpenseForm from "./components/CreateExpenseForm";
import ExpenseEntriesTable from "./components/ExpenseEntriesTable";
import ExpenseFiltersForm from "./components/ExpenseFiltersForm";
import ImportTransactionsForm from "./components/ImportTransactionsForm";
import ExpenseSummaryCards from "./components/ExpenseSummaryCards";
import SessionPanel from "./components/SessionPanel";

type DashboardTab = "view" | "create" | "budget" | "analytics";

interface ParsedCsvTransaction {
  title: string;
  notes: string;
  amount: number;
  spentAt: string;
  categoryName: string;
  entryType: EntryType;
}

interface LoginErrorData {
  detail?: string;
  attempts_left?: number;
  locked_out?: boolean;
  lockout_minutes?: number;
}

const REQUIRED_CSV_HEADERS = [
  "Date",
  "Counter Party",
  "Reference",
  "Type",
  "Amount (GBP)",
  "Spending Category",
] as const;

const IMPORT_CATEGORY_COLORS = [
  "#ef4444",
  "#0ea5e9",
  "#8b5cf6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
];

function parseCsvRows(rawCsv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < rawCsv.length; index += 1) {
    const character = rawCsv[index];

    if (character === '"') {
      if (inQuotes && rawCsv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && rawCsv[index + 1] === "\n") {
        index += 1;
      }

      row.push(field);
      field = "";

      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += character;
  }

  row.push(field);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function parseCsvDate(rawDate: string): string | null {
  const match = rawDate.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsedDate = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function normalizeImportedCategoryName(rawCategory: string): string {
  const cleaned = rawCategory.trim();
  if (!cleaned) {
    return "";
  }

  return cleaned
    .replace(/_/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseImportedTransactionsCsv(rawCsv: string): ParsedCsvTransaction[] {
  const rows = parseCsvRows(rawCsv);
  if (rows.length < 2) {
    throw new Error("No transaction rows found in CSV.");
  }

  const headers = rows[0].map((header, index) => {
    if (index === 0) {
      return header.replace(/^\uFEFF/, "").trim();
    }
    return header.trim();
  });

  const headerIndexByName = new Map<string, number>();
  headers.forEach((header, index) => {
    headerIndexByName.set(header, index);
  });

  for (const header of REQUIRED_CSV_HEADERS) {
    if (!headerIndexByName.has(header)) {
      throw new Error(`Missing required CSV column: ${header}`);
    }
  }

  const transactions: ParsedCsvTransaction[] = [];

  for (const row of rows.slice(1)) {
    const dateValue = row[headerIndexByName.get("Date") ?? -1] ?? "";
    const counterParty = (row[headerIndexByName.get("Counter Party") ?? -1] ?? "").trim();
    const reference = (row[headerIndexByName.get("Reference") ?? -1] ?? "").trim();
    const type = (row[headerIndexByName.get("Type") ?? -1] ?? "").trim();
    const amountRaw = (row[headerIndexByName.get("Amount (GBP)") ?? -1] ?? "").trim();
    const spendingCategory = (row[headerIndexByName.get("Spending Category") ?? -1] ?? "").trim();
    const notesRaw = (row[headerIndexByName.get("Notes") ?? -1] ?? "").trim();

    const spentAt = parseCsvDate(dateValue);
    const amount = Number(amountRaw.replace(/,/g, ""));

    if (!spentAt || !Number.isFinite(amount) || amount === 0) {
      continue;
    }

    const title = counterParty || reference || type || "Imported transaction";
    const noteParts = [
      reference && reference !== title ? `Ref: ${reference}` : "",
      type ? `Type: ${type}` : "",
      notesRaw,
    ].filter((part) => part.length > 0);

    transactions.push({
      title,
      notes: noteParts.join(" | "),
      amount: Math.abs(amount),
      spentAt,
      categoryName: normalizeImportedCategoryName(spendingCategory),
      entryType: amount > 0 ? "income" : "expense",
    });
  }

  return transactions;
}

function ExpenseDashboard() {
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("StrongPassword123!");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [activeTab, setActiveTab] = useState<DashboardTab>("view");

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [budgets, setBudgets] = useState<ExpenseBudget[]>([]);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    total_amount: "0.00",
    total_count: 0,
    by_category: [],
  });
  const [expenseStatus, setExpenseStatus] = useState("No transaction data loaded yet.");
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);

  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState("#0ea5e9");

  const [expenseTitle, setExpenseTitle] = useState("");
  const [expenseType, setExpenseType] = useState<EntryType>("expense");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseCategoryId, setExpenseCategoryId] = useState("");

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterEntryType, setFilterEntryType] = useState<EntryType | "">("");
  const [filterCategoryId, setFilterCategoryId] = useState("");

  const currencyFormatter = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  });

  const getCurrentFilters = useCallback((): ExpenseEntryFilters => {
    const filters: ExpenseEntryFilters = {};

    if (filterFrom) {
      filters.from = filterFrom;
    }
    if (filterTo) {
      filters.to = filterTo;
    }
    if (filterCategoryId) {
      filters.category = Number(filterCategoryId);
    }
    if (filterEntryType) {
      filters.entryType = filterEntryType;
    }
    if (filterSearch.trim()) {
      filters.search = filterSearch.trim();
    }

    return filters;
  }, [filterCategoryId, filterEntryType, filterFrom, filterSearch, filterTo]);

  const formatMoney = (amount: string): string => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) {
      return amount;
    }
    return currencyFormatter.format(numericAmount);
  };

  const loadExpenseData = useCallback(
    async (filters?: ExpenseEntryFilters) => {
      const activeFilters = filters ?? getCurrentFilters();
      setIsLoadingExpenses(true);
      try {
        const [nextCategories, nextBudgets, nextEntries, nextSummary] = await Promise.all([
          listExpenseCategories(),
          listExpenseBudgets(),
          listExpenseEntries(activeFilters),
          getExpenseSummary(activeFilters),
        ]);

        setCategories(nextCategories);
        setBudgets(nextBudgets);
        setEntries(nextEntries);
        setSummary(nextSummary);
        setExpenseStatus(
          `Loaded ${nextEntries.length} transaction${nextEntries.length === 1 ? "" : "s"}.`,
        );
      } catch {
        setExpenseStatus("Failed to load transaction data.");
      } finally {
        setIsLoadingExpenses(false);
      }
    },
    [getCurrentFilters],
  );

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);

    if (tab === "create") {
      setExpenseStatus("Ready to create a transaction.");
      return;
    }

    if (tab === "budget") {
      setExpenseStatus("Set monthly budgets by category.");
      return;
    }

    if (tab === "analytics") {
      setExpenseStatus("Viewing analytics for visible transactions.");
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        await bootstrapCsrf();
        const user = await getCurrentUser();
        setCurrentUser(user);
        setStatus(`Signed in as ${user.username}`);
      } catch {
        setStatus("Not signed in");
      }
    };

    void initialize();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void loadExpenseData(getCurrentFilters());
  }, [
    currentUser,
    filterCategoryId,
    filterEntryType,
    filterFrom,
    filterSearch,
    filterTo,
    getCurrentFilters,
    loadExpenseData,
  ]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const user = await login({ username, password });
      setCurrentUser(user);
      setStatus(`Signed in as ${user.username}`);
      setActiveTab("view");
    } catch (error) {
      if (error instanceof ApiRequestError && error.data && typeof error.data === "object") {
        const data = error.data as LoginErrorData;

        if (data.locked_out) {
          const lockoutMinutes = typeof data.lockout_minutes === "number" ? data.lockout_minutes : 60;
          setStatus(`Too many failed attempts. Your account is locked for ${lockoutMinutes} minute(s).`);
          return;
        }

        if (typeof data.attempts_left === "number" && data.attempts_left < 3) {
          setStatus(
            `Login failed. ${data.attempts_left} attempt(s) left before temporary lockout.`,
          );
          return;
        }

        if (typeof data.detail === "string" && data.detail.length > 0) {
          setStatus(data.detail);
          return;
        }
      }

      setStatus("Login failed. Check credentials.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setStatus("Signed out");
      setActiveTab("view");
      setFilterFrom("");
      setFilterTo("");
      setFilterSearch("");
      setFilterEntryType("");
      setFilterCategoryId("");
      setCategories([]);
      setBudgets([]);
      setEntries([]);
      setSummary({ total_amount: "0.00", total_count: 0, by_category: [] });
      setExpenseStatus("Signed out.");
    } catch {
      setStatus("Logout failed");
    }
  };

  const handleCreateCategory = async (event: FormEvent) => {
    event.preventDefault();

    if (!categoryName.trim()) {
      setExpenseStatus("Category name is required.");
      return;
    }

    try {
      await createExpenseCategory({
        name: categoryName.trim(),
        color: categoryColor,
      });
      setCategoryName("");
      setExpenseStatus("Category created.");
      await loadExpenseData();
    } catch {
      setExpenseStatus("Failed to create category.");
    }
  };

  const handleCreateExpense = async (event: FormEvent) => {
    event.preventDefault();

    if (!expenseTitle.trim()) {
      setExpenseStatus("Transaction title is required.");
      return;
    }

    if (!expenseAmount || Number(expenseAmount) <= 0) {
      setExpenseStatus("Amount must be greater than 0.");
      return;
    }

    try {
      await createExpenseEntry({
        title: expenseTitle.trim(),
        notes: expenseNotes,
        entry_type: expenseType,
        amount: Number(expenseAmount).toFixed(2),
        spent_at: expenseDate,
        category: expenseCategoryId ? Number(expenseCategoryId) : null,
      });

      setExpenseTitle("");
      setExpenseType("expense");
      setExpenseAmount("");
      setExpenseNotes("");
      setExpenseCategoryId("");
      setExpenseStatus("Transaction created.");
      await loadExpenseData();
    } catch {
      setExpenseStatus("Failed to create transaction.");
    }
  };

  const handleClearFilters = () => {
    setFilterFrom("");
    setFilterTo("");
    setFilterSearch("");
    setFilterEntryType("");
    setFilterCategoryId("");
  };

  const handleDeleteExpense = async (entryId: number) => {
    try {
      await deleteExpenseEntry(entryId);
      setExpenseStatus("Expense deleted.");
      await loadExpenseData();
    } catch {
      setExpenseStatus("Failed to delete expense.");
    }
  };

  const handleSaveBudget = async (categoryId: number, amount: string) => {
    setIsSavingBudget(true);
    try {
      const existing = budgets.find((budget) => budget.category === categoryId);

      if (existing) {
        await updateExpenseBudget(existing.id, { amount });
        setExpenseStatus("Budget updated.");
      } else {
        await createExpenseBudget({ category: categoryId, amount });
        setExpenseStatus("Budget created.");
      }

      await loadExpenseData(getCurrentFilters());
    } catch {
      setExpenseStatus("Failed to save budget.");
    } finally {
      setIsSavingBudget(false);
    }
  };

  const handleDeleteBudget = async (budgetId: number) => {
    try {
      await deleteExpenseBudget(budgetId);
      setExpenseStatus("Budget deleted.");
      await loadExpenseData(getCurrentFilters());
    } catch {
      setExpenseStatus("Failed to delete budget.");
    }
  };

  const handleImportTransactionsCsv = async (file: File) => {
    setIsImportingCsv(true);

    try {
      const rawCsv = await file.text();
      const parsedTransactions = parseImportedTransactionsCsv(rawCsv);

      if (parsedTransactions.length === 0) {
        setExpenseStatus("No valid transactions found in CSV.");
        return;
      }

      const categoryByName = new Map<string, ExpenseCategory>(
        categories.map((category) => [category.name.toLowerCase(), category]),
      );

      const uniqueImportedCategories = Array.from(
        new Set(
          parsedTransactions
            .map((transaction) => transaction.categoryName)
            .filter((categoryName) => categoryName.length > 0),
        ),
      );

      let createdCategoryCount = 0;

      for (const [index, categoryName] of uniqueImportedCategories.entries()) {
        const key = categoryName.toLowerCase();
        if (categoryByName.has(key)) {
          continue;
        }

        try {
          const createdCategory = await createExpenseCategory({
            name: categoryName,
            color: IMPORT_CATEGORY_COLORS[index % IMPORT_CATEGORY_COLORS.length],
          });
          categoryByName.set(key, createdCategory);
          createdCategoryCount += 1;
        } catch {
          // Ignore category creation conflicts so import can continue.
        }
      }

      let importedCount = 0;
      let failedCount = 0;

      for (const transaction of parsedTransactions) {
        try {
          const categoryId = transaction.categoryName
            ? categoryByName.get(transaction.categoryName.toLowerCase())?.id ?? null
            : null;

          await createExpenseEntry({
            title: transaction.title,
            notes: transaction.notes,
            entry_type: transaction.entryType,
            amount: transaction.amount.toFixed(2),
            spent_at: transaction.spentAt,
            category: categoryId,
          });
          importedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      setExpenseStatus(
        `Imported ${importedCount} transaction${importedCount === 1 ? "" : "s"} from CSV${
          createdCategoryCount > 0 ? ` and created ${createdCategoryCount} categor${createdCategoryCount === 1 ? "y" : "ies"}` : ""
        }${failedCount > 0 ? ` (${failedCount} failed)` : ""}.`,
      );

      await loadExpenseData(getCurrentFilters());
    } catch {
      setExpenseStatus("Failed to import CSV. Ensure the file matches the expected format.");
    } finally {
      setIsImportingCsv(false);
    }
  };

  return (
    <main className="shell">
      <h1>Expense Tracker MVP</h1>
      <p className="status" aria-live="polite">
        {status}
      </p>

      {currentUser ? (
        <>
          <SessionPanel user={currentUser} onLogout={() => void handleLogout()} />

          <section className="tab-bar" role="tablist" aria-label="Expense pages">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "view"}
              className={`tab-button ${activeTab === "view" ? "active" : ""}`}
              onClick={() => handleTabChange("view")}
            >
              View Transactions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "create"}
              className={`tab-button ${activeTab === "create" ? "active" : ""}`}
              onClick={() => handleTabChange("create")}
            >
              Create Transaction
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "budget"}
              className={`tab-button ${activeTab === "budget" ? "active" : ""}`}
              onClick={() => handleTabChange("budget")}
            >
              Budget Setup
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "analytics"}
              className={`tab-button ${activeTab === "analytics" ? "active" : ""}`}
              onClick={() => handleTabChange("analytics")}
            >
              Analytics
            </button>
          </section>

          {activeTab === "view" ? (
            <>
              <ExpenseSummaryCards summary={summary} formatMoney={formatMoney} />

              <ExpenseFiltersForm
                filterFrom={filterFrom}
                filterTo={filterTo}
                filterSearch={filterSearch}
                filterEntryType={filterEntryType}
                filterCategoryId={filterCategoryId}
                categories={categories}
                onFilterFromChange={setFilterFrom}
                onFilterToChange={setFilterTo}
                onFilterSearchChange={setFilterSearch}
                onFilterEntryTypeChange={setFilterEntryType}
                onFilterCategoryChange={setFilterCategoryId}
                onClearFilters={handleClearFilters}
              />

              <ExpenseEntriesTable
                entries={entries}
                isLoading={isLoadingExpenses}
                status={expenseStatus}
                formatMoney={formatMoney}
                onDeleteEntry={(entryId) => void handleDeleteExpense(entryId)}
              />
            </>
          ) : activeTab === "create" ? (
            <>
              <p className="status" aria-live="polite">
                {expenseStatus}
              </p>

              <section className="panel-grid">
                <CreateCategoryForm
                  categoryName={categoryName}
                  categoryColor={categoryColor}
                  onCategoryNameChange={setCategoryName}
                  onCategoryColorChange={setCategoryColor}
                  onSubmit={(event) => void handleCreateCategory(event)}
                />

                <CreateExpenseForm
                  title={expenseTitle}
                  entryType={expenseType}
                  amount={expenseAmount}
                  spentAt={expenseDate}
                  notes={expenseNotes}
                  categoryId={expenseCategoryId}
                  categories={categories}
                  onTitleChange={setExpenseTitle}
                  onEntryTypeChange={setExpenseType}
                  onAmountChange={setExpenseAmount}
                  onSpentAtChange={setExpenseDate}
                  onCategoryIdChange={setExpenseCategoryId}
                  onNotesChange={setExpenseNotes}
                  onSubmit={(event) => void handleCreateExpense(event)}
                />

                <ImportTransactionsForm
                  isImporting={isImportingCsv}
                  onImportCsv={(file) => handleImportTransactionsCsv(file)}
                />
              </section>
            </>
          ) : activeTab === "budget" ? (
            <BudgetSetupPanel
              categories={categories}
              budgets={budgets}
              status={expenseStatus}
              isSaving={isSavingBudget}
              formatMoney={formatMoney}
              onSaveBudget={handleSaveBudget}
              onDeleteBudget={handleDeleteBudget}
            />
          ) : (
            <ExpenseAnalyticsPanel entries={entries} budgets={budgets} />
          )}
        </>
      ) : (
        <LoginForm
          username={username}
          password={password}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={(event) => void handleLogin(event)}
        />
      )}
    </main>
  );
}

export default ExpenseDashboard;
