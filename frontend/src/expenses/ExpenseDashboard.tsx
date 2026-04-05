import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

import LoginForm from "../auth/components/LoginForm";
import { bootstrapCsrf, getCurrentUser, login, logout } from "../auth/authService";
import type { AuthUser } from "../auth/types";
import {
  createExpenseCategory,
  createExpenseEntry,
  deleteExpenseEntry,
  getExpenseSummary,
  listExpenseCategories,
  listExpenseEntries,
} from "./expenseService";
import type {
  EntryType,
  ExpenseCategory,
  ExpenseEntry,
  ExpenseEntryFilters,
  ExpenseSummary,
} from "./types";
import CreateCategoryForm from "./components/CreateCategoryForm";
import ExpenseAnalyticsPanel from "./components/ExpenseAnalyticsPanel";
import CreateExpenseForm from "./components/CreateExpenseForm";
import ExpenseEntriesTable from "./components/ExpenseEntriesTable";
import ExpenseFiltersForm from "./components/ExpenseFiltersForm";
import ExpenseSummaryCards from "./components/ExpenseSummaryCards";
import SessionPanel from "./components/SessionPanel";

type DashboardTab = "view" | "create" | "analytics";

function ExpenseDashboard() {
  const [username, setUsername] = useState("testuser");
  const [password, setPassword] = useState("StrongPassword123!");
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [activeTab, setActiveTab] = useState<DashboardTab>("view");

  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [entries, setEntries] = useState<ExpenseEntry[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
    total_amount: "0.00",
    total_count: 0,
    by_category: [],
  });
  const [expenseStatus, setExpenseStatus] = useState("No transaction data loaded yet.");
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);

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

    return filters;
  }, [filterCategoryId, filterEntryType, filterFrom, filterTo]);

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
        const [nextCategories, nextEntries, nextSummary] = await Promise.all([
          listExpenseCategories(),
          listExpenseEntries(activeFilters),
          getExpenseSummary(activeFilters),
        ]);

        setCategories(nextCategories);
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
        await loadExpenseData({});
      } catch {
        setStatus("Not signed in");
      }
    };

    void initialize();
  }, [loadExpenseData]);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const user = await login({ username, password });
      setCurrentUser(user);
      setStatus(`Signed in as ${user.username}`);
      setActiveTab("view");
      await loadExpenseData({});
    } catch {
      setStatus("Login failed. Check credentials.");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentUser(null);
      setStatus("Signed out");
      setActiveTab("view");
      setCategories([]);
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

  const handleApplyFilters = async (event: FormEvent) => {
    event.preventDefault();
    await loadExpenseData(getCurrentFilters());
  };

  const handleClearFilters = async () => {
    setFilterFrom("");
    setFilterTo("");
    setFilterEntryType("");
    setFilterCategoryId("");
    await loadExpenseData({});
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
                filterEntryType={filterEntryType}
                filterCategoryId={filterCategoryId}
                categories={categories}
                onFilterFromChange={setFilterFrom}
                onFilterToChange={setFilterTo}
                onFilterEntryTypeChange={setFilterEntryType}
                onFilterCategoryChange={setFilterCategoryId}
                onApplyFilters={(event) => void handleApplyFilters(event)}
                onClearFilters={() => void handleClearFilters()}
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
              </section>
            </>
          ) : (
            <ExpenseAnalyticsPanel entries={entries} formatMoney={formatMoney} />
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
