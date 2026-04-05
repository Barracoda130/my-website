import type { FormEvent } from "react";

import type { EntryType, ExpenseCategory } from "../types";

interface CreateExpenseFormProps {
  title: string;
  entryType: EntryType;
  amount: string;
  spentAt: string;
  notes: string;
  categoryId: string;
  categories: ExpenseCategory[];
  onTitleChange: (value: string) => void;
  onEntryTypeChange: (value: EntryType) => void;
  onAmountChange: (value: string) => void;
  onSpentAtChange: (value: string) => void;
  onCategoryIdChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function CreateExpenseForm({
  title,
  entryType,
  amount,
  spentAt,
  notes,
  categoryId,
  categories,
  onTitleChange,
  onEntryTypeChange,
  onAmountChange,
  onSpentAtChange,
  onCategoryIdChange,
  onNotesChange,
  onSubmit,
}: CreateExpenseFormProps) {
  return (
    <section className="panel">
      <h2>Create Transaction</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="expense-title">Title</label>
        <input
          id="expense-title"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Lunch"
        />

        <label htmlFor="entry-type">Type</label>
        <select
          id="entry-type"
          value={entryType}
          onChange={(event) => onEntryTypeChange(event.target.value as EntryType)}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>

        <label htmlFor="expense-amount">Amount</label>
        <input
          id="expense-amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="12.50"
        />

        <label htmlFor="expense-date">Date</label>
        <input
          id="expense-date"
          type="date"
          value={spentAt}
          onChange={(event) => onSpentAtChange(event.target.value)}
        />

        <label htmlFor="expense-category">Category</label>
        <select
          id="expense-category"
          value={categoryId}
          onChange={(event) => onCategoryIdChange(event.target.value)}
        >
          <option value="">Uncategorized</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>

        <label htmlFor="expense-notes">Notes</label>
        <textarea
          id="expense-notes"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          rows={3}
          placeholder="Optional details"
        />

        <button type="submit">Add Transaction</button>
      </form>
    </section>
  );
}

export default CreateExpenseForm;
