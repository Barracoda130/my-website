import { useMemo, useState } from "react";
import type { FormEvent } from "react";

import type { ExpenseBudget, ExpenseCategory } from "../types";

interface BudgetSetupPanelProps {
  categories: ExpenseCategory[];
  budgets: ExpenseBudget[];
  status: string;
  isSaving: boolean;
  formatMoney: (amount: string) => string;
  onSaveBudget: (categoryId: number, amount: string) => Promise<void>;
  onDeleteBudget: (budgetId: number) => Promise<void>;
}

function BudgetSetupPanel({
  categories,
  budgets,
  status,
  isSaving,
  formatMoney,
  onSaveBudget,
  onDeleteBudget,
}: BudgetSetupPanelProps) {
  const [budgetCategoryId, setBudgetCategoryId] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");

  const sortedBudgets = useMemo(
    () => [...budgets].sort((left, right) => left.category_name.localeCompare(right.category_name)),
    [budgets],
  );

  const existingBudget = budgets.find((budget) => String(budget.category) === budgetCategoryId);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!budgetCategoryId) {
      return;
    }

    const numericAmount = Number(budgetAmount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    await onSaveBudget(Number(budgetCategoryId), numericAmount.toFixed(2));
    setBudgetAmount("");
  };

  return (
    <section className="panel">
      <h2>Budget Setup</h2>
      <p className="status" aria-live="polite">
        {status}
      </p>

      <section className="budget-setup-grid">
        <article className="budget-card">
          <h3>Set Monthly Budget</h3>
          <form onSubmit={(event) => void handleSubmit(event)}>
            <label htmlFor="budget-category">Category</label>
            <select
              id="budget-category"
              value={budgetCategoryId}
              onChange={(event) => setBudgetCategoryId(event.target.value)}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>

            <label htmlFor="budget-amount">Budget Amount</label>
            <input
              id="budget-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={budgetAmount}
              onChange={(event) => setBudgetAmount(event.target.value)}
            />

            {existingBudget ? (
              <p className="budget-hint">
                Existing budget for this category: {formatMoney(existingBudget.amount)}. Saving will update it.
              </p>
            ) : (
              <p className="budget-hint">Set a budget for each category you want to track in analytics.</p>
            )}

            <button type="submit" disabled={isSaving || !budgetCategoryId || !budgetAmount.trim()}>
              {existingBudget ? "Update Budget" : "Save Budget"}
            </button>
          </form>
        </article>

        <article className="budget-card">
          <h3>Current Budgets</h3>
          {sortedBudgets.length === 0 ? (
            <p>No budgets set yet.</p>
          ) : (
            <table className="budget-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Monthly Budget</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedBudgets.map((budget) => (
                  <tr key={budget.id}>
                    <td>{budget.category_name}</td>
                    <td>{formatMoney(budget.amount)}</td>
                    <td>
                      <div className="button-row budget-actions">
                        <button
                          type="button"
                          onClick={() => {
                            setBudgetCategoryId(String(budget.category));
                            setBudgetAmount(budget.amount);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => void onDeleteBudget(budget.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
    </section>
  );
}

export default BudgetSetupPanel;
