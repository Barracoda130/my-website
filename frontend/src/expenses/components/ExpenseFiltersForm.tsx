import type { EntryType, ExpenseCategory } from "../types";

interface ExpenseFiltersFormProps {
  filterFrom: string;
  filterTo: string;
  filterSearch: string;
  filterCategoryId: string;
  filterEntryType: EntryType | "";
  categories: ExpenseCategory[];
  onFilterFromChange: (value: string) => void;
  onFilterToChange: (value: string) => void;
  onFilterSearchChange: (value: string) => void;
  onFilterCategoryChange: (value: string) => void;
  onFilterEntryTypeChange: (value: EntryType | "") => void;
  onClearFilters: () => void;
}

function ExpenseFiltersForm({
  filterFrom,
  filterTo,
  filterSearch,
  filterCategoryId,
  filterEntryType,
  categories,
  onFilterFromChange,
  onFilterToChange,
  onFilterSearchChange,
  onFilterCategoryChange,
  onFilterEntryTypeChange,
  onClearFilters,
}: ExpenseFiltersFormProps) {
  return (
    <section className="panel">
      <h2>Filters</h2>
      <div className="filter-search-box">
        <div className="filter-field">
          <label htmlFor="filter-search">Search</label>
          <input
            id="filter-search"
            type="search"
            value={filterSearch}
            onChange={(event) => onFilterSearchChange(event.target.value)}
            placeholder="Search title or notes"
          />
        </div>
      </div>

      <div className="filter-form">
        <div className="filter-field filter-inline-field">
          <label htmlFor="filter-from">From</label>
          <input
            id="filter-from"
            type="date"
            value={filterFrom}
            onChange={(event) => onFilterFromChange(event.target.value)}
          />
        </div>

        <div className="filter-field filter-inline-field">
          <label htmlFor="filter-to">To</label>
          <input
            id="filter-to"
            type="date"
            value={filterTo}
            onChange={(event) => onFilterToChange(event.target.value)}
          />
        </div>

        <div className="filter-field filter-inline-field">
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

        <div className="filter-field filter-inline-field">
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
          <button type="button" onClick={onClearFilters}>
            Clear
          </button>
        </div>
      </div>
    </section>
  );
}

export default ExpenseFiltersForm;
