import Papa from "papaparse";
import { normalizeAthleteName } from "./normalize";

export interface AthleteImportRow {
  name: string;
  normalizedName: string;
  rowNumber: number;
}

export interface AthleteImportRowSummary {
  uniqueRows: AthleteImportRow[];
  duplicateRows: AthleteImportRow[];
}

function slugHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function hasNameHeader(row: string[]): boolean {
  return row.some((cell) => slugHeader(cell) === "name");
}

export function parseAthleteImportCsv(input: string): AthleteImportRow[] {
  const parsed = Papa.parse<string[]>(input, {
    delimiter: ",",
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message);
  }

  const cleanRows = parsed.data.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!cleanRows.length) {
    return [];
  }

  const firstRow = cleanRows[0];
  const headerRow = hasNameHeader(firstRow);
  const nameIndex = headerRow ? firstRow.findIndex((cell) => slugHeader(cell) === "name") : 0;
  const dataRows = headerRow ? cleanRows.slice(1) : cleanRows;
  const rowOffset = headerRow ? 2 : 1;

  return dataRows
    .map((row, index) => {
      const name = String(row[nameIndex] ?? "").trim();
      const normalizedName = normalizeAthleteName(name);
      if (!normalizedName) {
        return null;
      }

      return {
        name,
        normalizedName,
        rowNumber: index + rowOffset,
      };
    })
    .filter((row): row is AthleteImportRow => Boolean(row));
}

export function summarizeAthleteImportRows(rows: AthleteImportRow[]): AthleteImportRowSummary {
  const seen = new Set<string>();
  const uniqueRows: AthleteImportRow[] = [];
  const duplicateRows: AthleteImportRow[] = [];

  for (const row of rows) {
    if (seen.has(row.normalizedName)) {
      duplicateRows.push(row);
      continue;
    }

    seen.add(row.normalizedName);
    uniqueRows.push(row);
  }

  return { uniqueRows, duplicateRows };
}
