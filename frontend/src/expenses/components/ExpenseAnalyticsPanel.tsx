import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { ExpenseEntry } from "../types";

interface ExpenseAnalyticsPanelProps {
  entries: ExpenseEntry[];
}

interface MonthlyTotals {
  key: string;
  label: string;
  income: number;
  expense: number;
}

interface CategorySlice {
  name: string;
  total: number;
  percent: number;
  color: string;
}

interface BudgetRow {
  name: string;
  actual: number;
  budget: number;
}

interface DashboardAnalytics {
  refreshedAt: string;
  visibleMonthCount: number;
  visibleMonthly: MonthlyTotals[];
  totalIncome: number;
  totalExpense: number;
  incomeCount: number;
  expenseCount: number;
  netBalance: number;
  savingsRate: number;
  expenseToIncomeRatio: number;
  incomeByCategory: CategorySlice[];
  expenseByCategory: CategorySlice[];
  budgetRows: BudgetRow[];
  budgetAxisMax: number;
  incomeTrend: number[];
  expenseTrend: number[];
  cashflowTrend: number[];
}

interface TrendChartCardProps {
  title: string;
  seriesLabel: string;
  accent: "cashflow" | "expense" | "income";
  historicalLabels: string[];
  actualValues: number[];
  formatCompactMoney: (amount: number) => string;
}

interface GaugeCardProps {
  title: string;
  value: number;
  caption: string;
  tone: "expense" | "savings";
}

const INCOME_COLORS = ["#9f1239", "#be185d", "#d946ef", "#c084fc", "#e879f9", "#f0abfc"];
const EXPENSE_COLORS = ["#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa", "#ffedd5"];
type MonthWindow = "all" | "3" | "6" | "12";

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildConicGradient(slices: CategorySlice[]): string {
  if (slices.length === 0) {
    return "conic-gradient(#e2e8f0 0% 100%)";
  }

  let cursor = 0;
  const stops: string[] = [];

  for (const slice of slices) {
    const nextCursor = Math.min(100, cursor + slice.percent);
    stops.push(`${slice.color} ${cursor}% ${nextCursor}%`);
    cursor = nextCursor;
  }

  if (cursor < 100) {
    stops.push(`#e2e8f0 ${cursor}% 100%`);
  }

  return `conic-gradient(${stops.join(",")})`;
}

function budgetFactorForCategory(categoryName: string): number {
  const hash = categoryName.split("").reduce((total, character) => total + character.charCodeAt(0), 0);
  return 0.9 + (hash % 4) * 0.1;
}

function GaugeCard({ title, value, caption, tone }: GaugeCardProps) {
  const normalized = Math.max(0, Math.min(100, value));
  const rotation = -90 + normalized * 1.8;

  return (
    <article className="analytics-gauge-card">
      <h3>{title}</h3>
      <div className={`analytics-gauge ${tone}`}>
        <div className="analytics-gauge-ring" aria-hidden="true"></div>
        <span className="analytics-gauge-needle" style={{ transform: `rotate(${rotation}deg)` }}></span>
        <span className="analytics-gauge-cap" aria-hidden="true"></span>
      </div>
      <p className="analytics-gauge-value">{value.toFixed(2)}%</p>
      <p className="analytics-card-meta">{caption}</p>
    </article>
  );
}

function TrendChartCard({
  title,
  seriesLabel,
  accent,
  historicalLabels,
  actualValues,
  formatCompactMoney,
}: TrendChartCardProps) {
  const chartWidth = 620;
  const chartHeight = 300;
  const padding = { top: 14, right: 14, bottom: 74, left: 54 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const totalPoints = historicalLabels.length;

  if (totalPoints === 0) {
    return (
      <article className="analytics-trend-card">
        <h3>{title}</h3>
        <p>No data available for this chart.</p>
      </article>
    );
  }

  const allValues = [...actualValues];
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const rawRange = rawMax - rawMin;
  const yPadding = rawRange > 0 ? rawRange * 0.15 : Math.max(rawMax * 0.2, 1);
  const yMin = Math.max(0, rawMin - yPadding);
  const yMax = Math.max(yMin + 1, rawMax + yPadding);
  const yRange = yMax - yMin;

  const xForIndex = (index: number): number => {
    if (totalPoints === 1) {
      return padding.left + plotWidth / 2;
    }

    return padding.left + (index / (totalPoints - 1)) * plotWidth;
  };

  const yForValue = (value: number): number => {
    const normalized = (value - yMin) / yRange;
    return padding.top + (1 - normalized) * plotHeight;
  };

  const actualPoints = actualValues.map((value, index) => ({
    x: xForIndex(index),
    y: yForValue(value),
  }));

  const yTicks = [yMax, yMin + yRange / 2, yMin];
  const xLabelStep = Math.max(1, Math.ceil(totalPoints / 5));

  return (
    <article className="analytics-trend-card">
      <h3>{title}</h3>
      <div className="analytics-trend-legend" aria-hidden="true">
        <span>
          <i className={`legend-dot ${accent}`}></i>
          {seriesLabel}
        </span>
      </div>
      <svg className="analytics-trend-svg" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={title}>
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} className="trend-axis" />
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          className="trend-axis"
        />

        {yTicks.map((tickValue) => {
          const y = yForValue(tickValue);
          return (
            <g key={`${title}-${tickValue}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                className="trend-grid-line"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="trend-y-label">
                {formatCompactMoney(tickValue)}
              </text>
            </g>
          );
        })}

        <path d={buildPath(actualPoints)} className={`trend-line ${accent}`} />

        {actualPoints.length > 0 ? (
          <circle
            cx={actualPoints[actualPoints.length - 1].x}
            cy={actualPoints[actualPoints.length - 1].y}
            r="4"
            className={`trend-point ${accent}`}
          />
        ) : null}

        {historicalLabels.map((label, index) => {
          const shouldShow = index % xLabelStep === 0 || index === historicalLabels.length - 1;
          if (!shouldShow) {
            return null;
          }

          const x = xForIndex(index);
          return (
            <text
              key={`${title}-label-${label}-${index}`}
              x={x}
              y={chartHeight - 14}
              className="trend-x-label"
              textAnchor="middle"
              transform={`rotate(-30 ${x} ${chartHeight - 14})`}
            >
              {label}
            </text>
          );
        })}
      </svg>
    </article>
  );
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

function ExpenseAnalyticsPanel({ entries }: ExpenseAnalyticsPanelProps) {
  const [monthWindow, setMonthWindow] = useState<MonthWindow>("all");

  const compactMoneyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    [],
  );

  const analytics = useMemo<DashboardAnalytics>(() => {
    const allMonthlyMap = new Map<string, MonthlyTotals>();

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount)) {
        continue;
      }

      const monthKey = entry.spent_at.slice(0, 7);
      if (!allMonthlyMap.has(monthKey)) {
        allMonthlyMap.set(monthKey, {
          key: monthKey,
          label: monthLabelFromKey(monthKey),
          income: 0,
          expense: 0,
        });
      }

      const monthTotals = allMonthlyMap.get(monthKey);
      if (!monthTotals) {
        continue;
      }

      if (entry.entry_type === "income") {
        monthTotals.income += amount;
      } else {
        monthTotals.expense += amount;
      }
    }

    const allMonthly = Array.from(allMonthlyMap.values()).sort((a, b) => a.key.localeCompare(b.key));
    const monthsToShow = monthWindow === "all" ? allMonthly.length : Number(monthWindow);
    const visibleMonthly = monthsToShow > 0 ? allMonthly.slice(-monthsToShow) : allMonthly;
    const visibleMonthKeys = new Set(visibleMonthly.map((month) => month.key));

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    const incomeCategoryTotals = new Map<string, number>();
    const expenseCategoryTotals = new Map<string, number>();

    for (const entry of entries) {
      const amount = Number(entry.amount);
      if (!Number.isFinite(amount)) {
        continue;
      }

      const monthKey = entry.spent_at.slice(0, 7);
      if (!visibleMonthKeys.has(monthKey)) {
        continue;
      }

      const categoryName = entry.category_name || "Uncategorized";

      if (entry.entry_type === "income") {
        totalIncome += amount;
        incomeCount += 1;
        incomeCategoryTotals.set(categoryName, (incomeCategoryTotals.get(categoryName) || 0) + amount);
      } else {
        totalExpense += amount;
        expenseCount += 1;
        expenseCategoryTotals.set(categoryName, (expenseCategoryTotals.get(categoryName) || 0) + amount);
      }
    }

    const toCategorySlices = (totals: Map<string, number>, colors: string[]): CategorySlice[] => {
      const totalValue = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

      return Array.from(totals.entries())
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([name, value], index) => ({
          name,
          total: value,
          percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
          color: colors[index % colors.length],
        }));
    };

    const incomeByCategory = toCategorySlices(incomeCategoryTotals, INCOME_COLORS);
    const expenseByCategory = toCategorySlices(expenseCategoryTotals, EXPENSE_COLORS);

    const budgetRows = Array.from(expenseCategoryTotals.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([name, actual]) => {
        const budget = actual * budgetFactorForCategory(name);
        return {
          name,
          actual,
          budget,
        };
      });

    const budgetAxisMax = Math.max(
      1,
      ...budgetRows.map((row) => Math.max(row.actual, row.budget)),
    );

    const incomeTrend = visibleMonthly.map((month) => month.income);
    const expenseTrend = visibleMonthly.map((month) => month.expense);
    const cashflowTrend = visibleMonthly.map((month) => month.income - month.expense);

    const netBalance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;
    const expenseToIncomeRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 0;

    return {
      refreshedAt: new Date().toLocaleString("en-GB", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      visibleMonthCount: visibleMonthly.length,
      visibleMonthly,
      totalIncome,
      totalExpense,
      incomeCount,
      expenseCount,
      netBalance,
      savingsRate,
      expenseToIncomeRatio,
      incomeByCategory,
      expenseByCategory,
      budgetRows,
      budgetAxisMax,
      incomeTrend,
      expenseTrend,
      cashflowTrend,
    };
  }, [entries, monthWindow]);

  const formatCompactMoney = (amount: number): string => compactMoneyFormatter.format(amount);

  const incomeDonutStyle: CSSProperties = {
    backgroundImage: buildConicGradient(analytics.incomeByCategory),
  };
  const expenseDonutStyle: CSSProperties = {
    backgroundImage: buildConicGradient(analytics.expenseByCategory),
  };

  return (
    <section className="panel analytics-panel">
      <header className="analytics-header">
        <h2>Personal Expense Analysis Dashboard</h2>
        <p className="analytics-refreshed">Data refreshed at {analytics.refreshedAt}</p>
      </header>

      <div className="analytics-dashboard-grid">
        <aside className="analytics-sidebar">
          <section className="analytics-filter-card">
            <label className="analytics-filter-label" htmlFor="analytics-month-window">
              Months
            </label>
            <select
              id="analytics-month-window"
              value={monthWindow}
              onChange={(event) => setMonthWindow(event.target.value as MonthWindow)}
            >
              <option value="all">All</option>
              <option value="3">Last 3 months</option>
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
            </select>
            <p className="analytics-filter-note">
              Showing {analytics.visibleMonthCount} month{analytics.visibleMonthCount === 1 ? "" : "s"}
            </p>
          </section>

          <article className="analytics-summary-tile">
            <h3>Total Expenses</h3>
            <p>{formatCompactMoney(analytics.totalExpense)}</p>
          </article>

          <article className="analytics-summary-tile">
            <h3>Total Income</h3>
            <p>{formatCompactMoney(analytics.totalIncome)}</p>
          </article>

          <article className="analytics-summary-tile muted">
            <h3>Net Balance</h3>
            <p>{formatCompactMoney(analytics.netBalance)}</p>
          </article>
        </aside>

        <div className="analytics-main-content">
          <section className="analytics-top-grid">
            <div className="analytics-gauge-stack">
              <GaugeCard
                title="Expense-to-Income Ratio"
                value={analytics.expenseToIncomeRatio}
                caption="Lower values indicate healthier spending relative to income."
                tone="expense"
              />
              <GaugeCard
                title="Savings Rate"
                value={analytics.savingsRate}
                caption="Share of income retained after expenses."
                tone="savings"
              />
            </div>

            <article className="analytics-viz-card">
              <h3>Income by Category</h3>
              {analytics.incomeByCategory.length === 0 ? (
                <p>No income transactions in this period.</p>
              ) : (
                <div className="analytics-donut-wrap">
                  <div className="analytics-donut" style={incomeDonutStyle} aria-hidden="true">
                    <div className="analytics-donut-center">
                      <strong>{formatCompactMoney(analytics.totalIncome)}</strong>
                      <span>Total</span>
                    </div>
                  </div>
                  <ul className="analytics-legend-list">
                    {analytics.incomeByCategory.map((slice) => (
                      <li key={`income-${slice.name}`}>
                        <span>
                          <i style={{ background: slice.color }}></i>
                          {slice.name}
                        </span>
                        <strong>{slice.percent.toFixed(1)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

            <article className="analytics-viz-card">
              <h3>Expense Breakdown by Category</h3>
              {analytics.expenseByCategory.length === 0 ? (
                <p>No expense transactions in this period.</p>
              ) : (
                <div className="analytics-donut-wrap">
                  <div className="analytics-donut" style={expenseDonutStyle} aria-hidden="true">
                    <div className="analytics-donut-center">
                      <strong>{formatCompactMoney(analytics.totalExpense)}</strong>
                      <span>Total</span>
                    </div>
                  </div>
                  <ul className="analytics-legend-list">
                    {analytics.expenseByCategory.map((slice) => (
                      <li key={`expense-${slice.name}`}>
                        <span>
                          <i style={{ background: slice.color }}></i>
                          {slice.name}
                        </span>
                        <strong>{slice.percent.toFixed(1)}%</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>

          </section>

          <section className="analytics-bottom-grid">
            <article className="analytics-viz-card analytics-budget-panel">
              <h3>Budget Compliance by Category</h3>
              {analytics.budgetRows.length === 0 ? (
                <p>No expense categories available for budget analysis.</p>
              ) : (
                <>
                  <div className="analytics-budget-legend" aria-hidden="true">
                    <span>
                      <i className="budget-swatch actual"></i> Actual
                    </span>
                    <span>
                      <i className="budget-swatch budget"></i> Budget
                    </span>
                  </div>
                  <div className="analytics-budget-axis" aria-hidden="true">
                    <span>0</span>
                    <span>{formatCompactMoney(analytics.budgetAxisMax / 2)}</span>
                    <span>{formatCompactMoney(analytics.budgetAxisMax)}</span>
                  </div>
                  <div className="analytics-budget-list">
                    {analytics.budgetRows.map((row) => {
                      const actualWidth = (row.actual / analytics.budgetAxisMax) * 100;
                      const budgetWidth = (row.budget / analytics.budgetAxisMax) * 100;
                      return (
                        <div className="analytics-budget-row" key={`budget-${row.name}`}>
                          <p>{row.name}</p>
                          <div className="analytics-budget-track">
                            <span className="analytics-budget-bar budget" style={{ width: `${budgetWidth}%` }}></span>
                            <span className="analytics-budget-bar actual" style={{ width: `${actualWidth}%` }}></span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </article>

            <TrendChartCard
              title="Cash Flow Trend"
              seriesLabel="Cashflow"
              accent="cashflow"
              historicalLabels={analytics.visibleMonthly.map((month) => month.label)}
              actualValues={analytics.cashflowTrend}
              formatCompactMoney={formatCompactMoney}
            />

            <TrendChartCard
              title="Expense Trend"
              seriesLabel="Expenses"
              accent="expense"
              historicalLabels={analytics.visibleMonthly.map((month) => month.label)}
              actualValues={analytics.expenseTrend}
              formatCompactMoney={formatCompactMoney}
            />

            <TrendChartCard
              title="Income Trend"
              seriesLabel="Income"
              accent="income"
              historicalLabels={analytics.visibleMonthly.map((month) => month.label)}
              actualValues={analytics.incomeTrend}
              formatCompactMoney={formatCompactMoney}
            />
          </section>
        </div>
      </div>
    </section>
  );
}

export default ExpenseAnalyticsPanel;
