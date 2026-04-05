import type { FormEvent } from "react";

import type { ExpenseCategory } from "../types";

interface ExpenseFiltersFormProps {
  filterFrom: string;
  filterTo: string;
  filterCategoryId: string;
  categories: ExpenseCategory[];
  onFilterFromChange: (value: string) => void;
  onFilterToChange: (value: string) => void;
  onFilterCategoryChange: (value: string) => void;
  onApplyFilters: (event: FormEvent) => void;
  onClearFilters: () => void;
}

function ExpenseFiltersForm({
  filterFrom,
  filterTo,
  filterCategoryId,
  categories,
  onFilterFromChange,
  onFilterToChange,
  onFilterCategoryChange,
  onApplyFilters,
  onClearFilters,
}: ExpenseFiltersFormProps) {
  return (
    <section className="panel">
      <h2>Filters</h2>
      <form className="filter-form" onSubmit={onApplyFilters}>
        <label htmlFor="filter-from">From</label>
        <input
          id="filter-from"
          type="date"
          value={filterFrom}
          onChange={(event) => onFilterFromChange(event.target.value)}
        />

        <label htmlFor="filter-to">To</label>
        <input
          id="filter-to"
          type="date"
          value={filterTo}
          onChange={(event) => onFilterToChange(event.target.value)}
        />

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

        <div className="button-row">
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
