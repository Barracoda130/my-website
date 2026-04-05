import type { FormEvent } from "react";

interface CreateCategoryFormProps {
  categoryName: string;
  categoryColor: string;
  onCategoryNameChange: (value: string) => void;
  onCategoryColorChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

function CreateCategoryForm({
  categoryName,
  categoryColor,
  onCategoryNameChange,
  onCategoryColorChange,
  onSubmit,
}: CreateCategoryFormProps) {
  return (
    <section className="panel">
      <h2>Create Category</h2>
      <form onSubmit={onSubmit}>
        <label htmlFor="category-name">Name</label>
        <input
          id="category-name"
          value={categoryName}
          onChange={(event) => onCategoryNameChange(event.target.value)}
          placeholder="Food"
        />

        <label htmlFor="category-color">Color</label>
        <input
          id="category-color"
          type="color"
          value={categoryColor}
          onChange={(event) => onCategoryColorChange(event.target.value)}
        />

        <button type="submit">Add Category</button>
      </form>
    </section>
  );
}

export default CreateCategoryForm;
