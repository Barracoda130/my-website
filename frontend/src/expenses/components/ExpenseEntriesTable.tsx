import { useMemo, useState } from "react";

import type { ExpenseEntry } from "../types";

type SortKey = "spent_at" | "title" | "entry_type" | "category_name" | "amount";
type SortDirection = "asc" | "desc";

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

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
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "spent_at",
    direction: "desc",
  });

  const sortedEntries = useMemo(() => {
    const sorted = [...entries];
    const modifier = sortConfig.direction === "asc" ? 1 : -1;

    sorted.sort((a, b) => {
      switch (sortConfig.key) {
        case "spent_at": {
          return a.spent_at.localeCompare(b.spent_at) * modifier;
        }
        case "amount": {
          return (Number(a.amount) - Number(b.amount)) * modifier;
        }
        case "title": {
          return a.title.localeCompare(b.title) * modifier;
        }
        case "entry_type": {
          return a.entry_type.localeCompare(b.entry_type) * modifier;
        }
        case "category_name": {
          return (a.category_name ?? "Uncategorized").localeCompare(
            b.category_name ?? "Uncategorized",
          ) * modifier;
        }
        default:
          return 0;
      }
    });

    return sorted;
  }, [entries, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  };

  const getSortIndicator = (key: SortKey): string => {
    if (sortConfig.key !== key) {
      return "";
    }

    return sortConfig.direction === "asc" ? " ▲" : " ▼";
  };

  return (
    <section className="panel">
      <h2>Recent Transactions</h2>
      <p className="status" aria-live="polite">
        {isLoading ? "Loading transaction data..." : status}
      </p>

      {entries.length === 0 ? (
        <p>No transactions found for the current filter.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>
                <button type="button" className="sort-button" onClick={() => handleSort("spent_at")}>
                  Date{getSortIndicator("spent_at")}
                </button>
              </th>
              <th>
                <button type="button" className="sort-button" onClick={() => handleSort("title")}>
                  Title{getSortIndicator("title")}
                </button>
              </th>
              <th>
                <button type="button" className="sort-button" onClick={() => handleSort("entry_type")}>
                  Type{getSortIndicator("entry_type")}
                </button>
              </th>
              <th>
                <button
                  type="button"
                  className="sort-button"
                  onClick={() => handleSort("category_name")}
                >
                  Category{getSortIndicator("category_name")}
                </button>
              </th>
              <th>
                <button type="button" className="sort-button" onClick={() => handleSort("amount")}>
                  Amount{getSortIndicator("amount")}
                </button>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.spent_at}</td>
                <td>
                  <strong>{entry.title}</strong>
                  {entry.notes ? <p className="notes">{entry.notes}</p> : null}
                </td>
                <td>{entry.entry_type === "income" ? "Income" : "Expense"}</td>
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
