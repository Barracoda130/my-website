import type { ExpenseEntry } from "../types";

interface ExpenseEntriesTableProps {
  entries: ExpenseEntry[];
  isLoading: boolean;
  status: string;
  formatMoney: (amount: string) => string;
  onDeleteEntry: (entryId: number) => void;
}

function ExpenseEntriesTable({
  entries,
  isLoading,
  status,
  formatMoney,
  onDeleteEntry,
}: ExpenseEntriesTableProps) {
  return (
    <section className="panel">
      <h2>Recent Expenses</h2>
      <p className="status" aria-live="polite">
        {isLoading ? "Loading expense data..." : status}
      </p>

      {entries.length === 0 ? (
        <p>No expenses found for the current filter.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Category</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.spent_at}</td>
                <td>
                  <strong>{entry.title}</strong>
                  {entry.notes ? <p className="notes">{entry.notes}</p> : null}
                </td>
                <td>{entry.category_name || "Uncategorized"}</td>
                <td>{formatMoney(entry.amount)}</td>
                <td>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => onDeleteEntry(entry.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default ExpenseEntriesTable;
