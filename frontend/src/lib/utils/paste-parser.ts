/**
 * Parses Excel clipboard content (tab-separated columns, newline-separated rows).
 * Strips Indian comma formatting from numeric values.
 * Returns only rows where the first column is non-empty.
 */
export function parseExcelPaste(text: string, numCols = 2): string[][] {
  return text
    .split("\n")
    .map((row) => row.replace(/\r$/, "").trim())
    .filter(Boolean)
    .map((row) => {
      const cols = row.split("\t");
      return Array.from({ length: numCols }, (_, i) =>
        (cols[i] ?? "").trim().replace(/,/g, ""),
      );
    })
    .filter((row) => row[0]);
}

/**
 * Parses Excel clipboard for key-value (name + amount) rows.
 * Handles merged cells: takes col[0] as name and the last non-empty column as amount.
 * This correctly handles Excel tables where "Particulars" spans multiple merged columns.
 */
export function parseExcelPasteKV(text: string): string[][] {
  return text
    .split("\n")
    .map((row) => row.replace(/\r$/, "").trim())
    .filter(Boolean)
    .map((row) => {
      const cols = row.split("\t").map((c) => c.trim().replace(/,/g, ""));
      const name = cols[0] ?? "";
      const amount = [...cols].slice(1).reverse().find((c) => c !== "") ?? "";
      return [name, amount];
    })
    .filter((row) => row[0]);
}
