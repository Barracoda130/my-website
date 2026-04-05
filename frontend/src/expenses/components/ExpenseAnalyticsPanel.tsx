import { useMemo, useState } from "react";

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
  const [monthlyTrendType, setMonthlyTrendType] = useState<"income" | "expense">("expense");

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

    const maxComparisonValue = Math.max(totalIncome, totalExpense, 1);

    return {
      totalIncome,
      totalExpense,
      netBalance,
      incomeCount,
      expenseCount,
      savingsRate,
      monthlyTotals,
      maxComparisonValue,
    };
  }, [entries]);

  const incomeShare = (analytics.totalIncome / analytics.maxComparisonValue) * 100;
  const expenseShare = (analytics.totalExpense / analytics.maxComparisonValue) * 100;
  const trendScale = useMemo(() => {
    const values = analytics.monthlyTotals.map((month) =>
      monthlyTrendType === "income" ? month.income : month.expense,
    );

    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 0;
    const range = maxValue - minValue;
    const padding = range > 0 ? range * 0.15 : Math.max(maxValue * 0.1, 1);

    const axisMin = Math.max(0, minValue - padding);
    const axisMax = Math.max(axisMin + 1, maxValue + padding);
    const axisMid = axisMin + (axisMax - axisMin) / 2;

    return {
      axisMin,
      axisMid,
      axisMax,
      range: axisMax - axisMin,
    };
  }, [analytics.monthlyTotals, monthlyTrendType]);

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

      <section className="analytics-graph-block" aria-label="Monthly trend chart">
        <h3>Monthly Trend</h3>
        <div className="analytics-trend-type" role="group" aria-label="Monthly trend type selector">
          <button
            type="button"
            className={`trend-toggle ${monthlyTrendType === "income" ? "active" : ""}`}
            onClick={() => setMonthlyTrendType("income")}
          >
            Income
          </button>
          <button
            type="button"
            className={`trend-toggle ${monthlyTrendType === "expense" ? "active" : ""}`}
            onClick={() => setMonthlyTrendType("expense")}
          >
            Expense
          </button>
        </div>
        {analytics.monthlyTotals.length === 0 ? (
          <p>No transactions available for monthly analytics yet.</p>
        ) : (
          <>
            <p className="analytics-axis-caption">Y-axis: Amount (auto-scaled to visible months). X-axis: Month.</p>
            <div
              className="analytics-trend-layout"
              role="img"
              aria-label={`Monthly ${monthlyTrendType} totals by month`}
            >
              <div className="analytics-y-axis" aria-hidden="true">
                <span>{formatMoney(trendScale.axisMax.toFixed(2))}</span>
                <span>{formatMoney(trendScale.axisMid.toFixed(2))}</span>
                <span>{formatMoney(trendScale.axisMin.toFixed(2))}</span>
              </div>

              <div className="analytics-month-chart single-series">
                {analytics.monthlyTotals.map((month) => {
                  const currentValue = monthlyTrendType === "income" ? month.income : month.expense;
                  const barHeight =
                    trendScale.range > 0
                      ? Math.max(
                        0,
                        Math.min(100, ((currentValue - trendScale.axisMin) / trendScale.range) * 100),
                      )
                      : 0;

                  return (
                    <article className="analytics-month-group" key={month.key}>
                      <div className="analytics-month-bars single-series">
                        <p className="analytics-month-value">{formatMoney(currentValue.toFixed(2))}</p>
                        <span
                          className={`analytics-month-bar ${monthlyTrendType}`}
                          style={{ height: `${barHeight}%` }}
                          title={`${monthlyTrendType === "income" ? "Income" : "Expense"} ${month.label}: ${formatMoney(currentValue.toFixed(2))}`}
                        ></span>
                      </div>
                      <p className="analytics-month-label">{month.label}</p>
                    </article>
                  );
                })}
              </div>
            </div>
            <p className="analytics-axis-label">Month</p>
          </>
        )}
      </section>
    </section>
  );
}

export default ExpenseAnalyticsPanel;
