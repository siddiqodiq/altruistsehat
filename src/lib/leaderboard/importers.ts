import Papa from "papaparse";
import { normalizeMetricValue } from "./metrics";
import { METRIC_COLUMN_ALIASES, type AthleteEntry, type MetricType } from "./types";

function slugHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function createAthlete(name: unknown, value: unknown, metric: MetricType): AthleteEntry | null {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) {
    return null;
  }

  return {
    id: `athlete-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    name: cleanName,
    value: normalizeMetricValue(value, metric),
  };
}

function valueFromRecord(record: Record<string, unknown>, metric: MetricType): unknown {
  const aliases = METRIC_COLUMN_ALIASES[metric];
  const entries = Object.entries(record);
  const matched = entries.find(([key]) => aliases.includes(slugHeader(key)));
  return matched?.[1] ?? record.value ?? record.distance ?? record.Distance;
}

export function parseJsonInput(input: string, metric: MetricType): AthleteEntry[] {
  const parsed = JSON.parse(input) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("JSON must be an array of athletes.");
  }

  return parsed
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      return createAthlete(record.name ?? record.Name, valueFromRecord(record, metric), metric);
    })
    .filter((row): row is AthleteEntry => Boolean(row));
}

function hasHeader(firstRow: unknown[]): boolean {
  const knownHeaders = new Set(["name", ...Object.values(METRIC_COLUMN_ALIASES).flat()]);
  return firstRow.some((cell) => {
    const value = slugHeader(cell);
    return knownHeaders.has(value);
  });
}

export function parseSpreadsheetRows(rows: unknown[][], metric: MetricType): AthleteEntry[] {
  const cleanRows = rows.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (!cleanRows.length) {
    return [];
  }

  if (!hasHeader(cleanRows[0])) {
    return cleanRows
      .map((row) => createAthlete(row[0], row[1], metric))
      .filter((row): row is AthleteEntry => Boolean(row));
  }

  const headers = cleanRows[0].map(slugHeader);
  const nameIndex = headers.findIndex((header) => header === "name");
  const valueIndex = headers.findIndex((header) => METRIC_COLUMN_ALIASES[metric].includes(header));

  return cleanRows
    .slice(1)
    .map((row) => createAthlete(row[nameIndex], row[valueIndex], metric))
    .filter((row): row is AthleteEntry => Boolean(row));
}

export function parseCsvInput(input: string, metric: MetricType): AthleteEntry[] {
  const parsed = Papa.parse<string[]>(input.trim(), {
    skipEmptyLines: true,
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message);
  }

  return parseSpreadsheetRows(parsed.data, metric);
}
