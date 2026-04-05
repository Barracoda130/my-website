import { useMemo } from "react";

import type { ExpenseEntry } from "../types";

interface ExpenseAnalyticsPanelProps {
  entries: ExpenseEntry[];
  formatMoney: (amount: string) => string;
}

interface MonthlyTotals {
  key: string;
  label: string;
  income: number;
  expense: number;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-");
  const parsedYear = Number(year);
  const parsedMonth = Number(month);

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
    return key;
  }

  const labelDate = new Date(parsedYear, parsedMonth - 1, 1);
  return labelDate.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function ExpenseAnalyticsPanel({ entries, formatMoney }: ExpenseAnalyticsPanelProps) {
  const analytics = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    const monthMap = new Map<string, MonthlyTotals>();

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount)) {
        continue;
      }

      const monthKey = entry.spent_at.slice(0, 7);
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          key: monthKey,
          label: monthLabelFromKey(monthKey),
          income: 0,
          expense: 0,
        });
      }

      const monthTotals = monthMap.get(monthKey);
      if (!monthTotals) {
        continue;
      }

      if (entry.entry_type === "income") {
        totalIncome += amount;
        incomeCount += 1;
        monthTotals.income += amount;
      } else {
        totalExpense += amount;
        expenseCount += 1;
        monthTotals.expense += amount;
      }
    }

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : null;

    const monthlyTotals = Array.from(monthMap.values()).sort((a, b) => a.key.localeCompare(b.key));

    const maxMonthlyValue = monthlyTotals.reduce((maxValue, month) => {
      const monthPeak = Math.max(month.income, month.expense);
      return Math.max(maxValue, monthPeak);
    }, 0);

    const maxComparisonValue = Math.max(totalIncome, totalExpense, 1);

    return {
      totalIncome,
      totalExpense,
      netBalance,
      incomeCount,
      expenseCount,
      savingsRate,
      monthlyTotals,
      maxMonthlyValue,
      maxComparisonValue,
    };
  }, [entries]);

  const incomeShare = (analytics.totalIncome / analytics.maxComparisonValue) * 100;
  const expenseShare = (analytics.totalExpense / analytics.maxComparisonValue) * 100;

  return (
    <section className="panel analytics-panel">
      <h2>Income vs Expense Analytics</h2>
      <p className="status" aria-live="polite">
        Based on {entries.length} visible transaction{entries.length === 1 ? "" : "s"}.
      </p>

      <section className="analytics-stat-grid" aria-label="Income and expense statistics">
        <article className="analytics-stat-card income">
          <h3>Total Income</h3>
          <p className="summary-value">{formatMoney(analytics.totalIncome.toFixed(2))}</p>
          <p>{analytics.incomeCount} income transaction{analytics.incomeCount === 1 ? "" : "s"}</p>
        </article>

        <article className="analytics-stat-card expense">
          <h3>Total Expense</h3>
          <p className="summary-value">{formatMoney(analytics.totalExpense.toFixed(2))}</p>
          <p>{analytics.expenseCount} expense transaction{analytics.expenseCount === 1 ? "" : "s"}</p>
        </article>

        <article className="analytics-stat-card net">
          <h3>Net Balance</h3>
          <p className="summary-value">{formatMoney(analytics.netBalance.toFixed(2))}</p>
          <p>
            Savings rate:{" "}
            {analytics.savingsRate === null ? "N/A" : `${analytics.savingsRate.toFixed(1)}%`}
          </p>
        </article>
      </section>

      <section className="analytics-graph-block" aria-label="Income and expense comparison chart">
        <h3>Income vs Expense</h3>
        <div className="analytics-bar-chart" role="img" aria-label="Comparison of total income and total expense">
          <div className="analytics-bar-row">
            <span className="analytics-bar-label">Income</span>
            <div className="analytics-bar-track">
              <span className="analytics-bar-fill income" style={{ width: `${incomeShare}%` }}></span>
            </div>
            <span>{formatMoney(analytics.totalIncome.toFixed(2))}</span>
          </div>
          <div className="analytics-bar-row">
            <span className="analytics-bar-label">Expense</span>
            <div className="analytics-bar-track">
              <span className="analytics-bar-fill expense" style={{ width: `${expenseShare}%` }}></span>
            </div>
            <span>{formatMoney(analytics.totalExpense.toFixed(2))}</span>
          </div>
        </div>
      </section>

      <section className="analytics-graph-block" aria-label="Monthly income and expense chart">
        <h3>Monthly Trend</h3>
        {analytics.monthlyTotals.length === 0 ? (
          <p>No transactions available for monthly analytics yet.</p>
        ) : (
          <>
            <div className="analytics-legend" aria-hidden="true">
              <span><i className="analytics-swatch income"></i> Income</span>
              <span><i className="analytics-swatch expense"></i> Expense</span>
            </div>
            <div className="analytics-month-chart" role="img" aria-label="Monthly income and expense bars">
              {analytics.monthlyTotals.map((month) => {
                const incomeHeight =
                  analytics.maxMonthlyValue > 0
                    ? Math.max((month.income / analytics.maxMonthlyValue) * 100, month.income > 0 ? 8 : 0)
                    : 0;
                const expenseHeight =
                  analytics.maxMonthlyValue > 0
                    ? Math.max((month.expense / analytics.maxMonthlyValue) * 100, month.expense > 0 ? 8 : 0)
                    : 0;

                return (
                  <article className="analytics-month-group" key={month.key}>
                    <div className="analytics-month-bars">
                      <span
                        className="analytics-month-bar income"
                        style={{ height: `${incomeHeight}%` }}
                        title={`Income ${month.label}: ${formatMoney(month.income.toFixed(2))}`}
                      ></span>
                      <span
                        className="analytics-month-bar expense"
                        style={{ height: `${expenseHeight}%` }}
                        title={`Expense ${month.label}: ${formatMoney(month.expense.toFixed(2))}`}
                      ></span>
                    </div>
                    <p className="analytics-month-label">{month.label}</p>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </section>
  );
}

export default ExpenseAnalyticsPanel;
