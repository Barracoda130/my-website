import type { FormEvent } from "react";

import type { EntryType, ExpenseCategory } from "../types";

interface ExpenseFiltersFormProps {
  filterFrom: string;
  filterTo: string;
  filterCategoryId: string;
  filterEntryType: EntryType | "";
  categories: ExpenseCategory[];
  onFilterFromChange: (value: string) => void;
  onFilterToChange: (value: string) => void;
  onFilterCategoryChange: (value: string) => void;
  onFilterEntryTypeChange: (value: EntryType | "") => void;
  onApplyFilters: (event: FormEvent) => void;
  onClearFilters: () => void;
}

function ExpenseFiltersForm({
  filterFrom,
  filterTo,
  filterCategoryId,
  filterEntryType,
  categories,
  onFilterFromChange,
  onFilterToChange,
  onFilterCategoryChange,
  onFilterEntryTypeChange,
  onApplyFilters,
  onClearFilters,
}: ExpenseFiltersFormProps) {
  return (
    <section className="panel">
      <h2>Filters</h2>
      <form className="filter-form" onSubmit={onApplyFilters}>
        <div className="filter-field">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={filterFrom}
            onChange={(event) => onFilterFromChange(event.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={filterTo}
            onChange={(event) => onFilterToChange(event.target.value)}
          />
        </div>

        <div className="filter-field">
          <label htmlFor="filter-entry-type">Type</label>
          <select
            id="filter-entry-type"
            value={filterEntryType}
            onChange={(event) => onFilterEntryTypeChange(event.target.value as EntryType | "")}
          >
            <option value="">All types</option>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div className="filter-field">
          <label htmlFor="filter-category">Category</label>
          <select
            id="filter-category"
            value={filterCategoryId}
            onChange={(event) => onFilterCategoryChange(event.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="button-row filter-actions">
          <button type="submit">Apply Filters</button>
          <button type="button" onClick={onClearFilters}>
            Clear
          </button>
        </div>
      </form>
    </section>
  );
}

export default ExpenseFiltersForm;
