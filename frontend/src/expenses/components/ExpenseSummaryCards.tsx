import type { ExpenseSummary } from "../types";

interface ExpenseSummaryCardsProps {
  summary: ExpenseSummary;
  formatMoney: (amount: string) => string;
}

function ExpenseSummaryCards({ summary, formatMoney }: ExpenseSummaryCardsProps) {
  return (
    <section className="summary-grid">
      <article className="summary-card">
        <h3>Total Spend</h3>
        <p className="summary-value">{formatMoney(summary.total_amount)}</p>
      </article>
      <article className="summary-card">
        <h3>Transactions</h3>
        <p className="summary-value">{summary.total_count}</p>
      </article>
      <article className="summary-card">
        <h3>Categories</h3>
        <p className="summary-value">{summary.by_category.length}</p>
      </article>
    </section>
  );
}

export default ExpenseSummaryCards;
