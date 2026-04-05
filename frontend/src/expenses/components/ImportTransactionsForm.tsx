import { useState } from "react";
import type { FormEvent } from "react";

interface ImportTransactionsFormProps {
  isImporting: boolean;
  onImportCsv: (file: File) => Promise<void>;
}

function ImportTransactionsForm({ isImporting, onImportCsv }: ImportTransactionsFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedFile) {
      return;
    }

    await onImportCsv(selectedFile);
    setSelectedFile(null);

    const input = document.getElementById("csv-import-file") as HTMLInputElement | null;
    if (input) {
      input.value = "";
    }
  };

  return (
    <section className="panel import-panel">
      <h2>Import Transactions (CSV)</h2>
      <p className="import-help">
        Expected columns: Date, Counter Party, Reference, Type, Amount (GBP), Balance (GBP),
        Spending Category, Notes.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)}>
        <label htmlFor="csv-import-file">CSV File</label>
        <input
          id="csv-import-file"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
        />

        <button type="submit" disabled={!selectedFile || isImporting}>
          {isImporting ? "Importing..." : "Import CSV"}
        </button>
      </form>
    </section>
  );
}

export default ImportTransactionsForm;
