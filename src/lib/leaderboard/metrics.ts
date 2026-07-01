import type { MetricType } from "./types";

const timeMinutesError = "Time must be a whole number of minutes.";

const metricUnits: Record<MetricType, string> = {
  distance_km: "km",
  cycling_distance_km: "km",
  elevation_m: "m",
  time_minutes: "menit",
  activities_count: "activities",
};

function extractNumber(value: string): number {
  const trimmed = value.trim();
  const match = trimmed.match(/[+-]?\d[\d.,]*/);

  if (!match) {
    return 0;
  }

  const raw = match[0];
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const normalized = (() => {
    if (lastComma > -1 && lastDot > -1) {
      return lastComma > lastDot
        ? raw.replace(/\./g, "").replace(",", ".")
        : raw.replace(/,/g, "");
    }

    if (lastComma > -1) {
      const decimalComma = /^[+-]?\d+,\d{1,2}$/.test(raw);
      return decimalComma ? raw.replace(",", ".") : raw.replace(/,/g, "");
    }

    if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(raw)) {
      return raw.replace(/\./g, "");
    }

    return raw;
  })();

  return Number.parseFloat(normalized);
}

function normalizeTimeMinutesValue(value: unknown): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error(timeMinutesError);
    }

    return value;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return 0;
  }

  if (!/^\d+$/.test(text)) {
    throw new Error(timeMinutesError);
  }

  return Number.parseInt(text, 10);
}

export function normalizeMetricValue(value: unknown, metric: MetricType): number {
  if (metric === "time_minutes") {
    return normalizeTimeMinutesValue(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return value;
  }

  const text = String(value ?? "").trim();
  if (!text) {
    return 0;
  }

  return extractNumber(text);
}

function safeMetricNumber(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatTimeMinutes(value: number | null | undefined): string {
  const totalMinutes = Math.max(0, Math.round(safeMetricNumber(value)));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} jam ${minutes} menit`;
  }

  if (hours > 0) {
    return `${hours} jam`;
  }

  return `${minutes} menit`;
}

export function metricUnit(metric: MetricType): string {
  return metricUnits[metric];
}

export function formatMetricNumber(value: number | null | undefined, maximumFractionDigits = 1, minimumFractionDigits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(safeMetricNumber(value));
}

type MetricValueFormatOptions = {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

export type MetricDisplayParts = {
  primary: string;
  accent: string;
};

export function formatMetricDisplayParts(
  value: number | null | undefined,
  metric: MetricType,
  options: MetricValueFormatOptions = {},
): MetricDisplayParts {
  if (metric === "time_minutes") {
    const totalMinutes = Math.max(0, Math.round(safeMetricNumber(value)));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours > 0 && minutes > 0) {
      return { primary: `${hours} jam`, accent: `${minutes} menit` };
    }

    if (hours > 0) {
      return { primary: `${hours} jam`, accent: "" };
    }

    return { primary: `${minutes} menit`, accent: "" };
  }

  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
  const safeValue = Math.max(0, safeMetricNumber(value));

  return {
    primary: formatMetricNumber(safeValue, maximumFractionDigits, minimumFractionDigits),
    accent: metricUnit(metric).toUpperCase(),
  };
}

export function formatMetricValue(
  value: number | null | undefined,
  metric: MetricType,
  options: MetricValueFormatOptions = {},
): string {
  if (metric === "time_minutes") {
    return formatTimeMinutes(value);
  }

  const { minimumFractionDigits = 2, maximumFractionDigits = 2 } = options;
  const safeValue = Math.max(0, safeMetricNumber(value));
  return `${formatMetricNumber(safeValue, maximumFractionDigits, minimumFractionDigits)} ${metricUnit(metric)}`;
}

export function calculateWeeklyComparison(current: number, previous?: number): string {
  if (!previous || previous <= 0) {
    return "—";
  }

  const percent = ((current - previous) / previous) * 100;
  if (percent === 0) {
    return "0%";
  }

  const sign = percent > 0 ? "+" : "";
  return `${sign}${formatMetricNumber(percent, 0, 0)}%`;
}

export function sumMetricValues(values: { value: number }[]): number {
  return values.reduce((total, row) => total + row.value, 0);
}

export function resolveMetricTotal(values: { value: number }[], totalOverride?: number): number {
  return typeof totalOverride === "number" && Number.isFinite(totalOverride) ? totalOverride : sumMetricValues(values);
}
