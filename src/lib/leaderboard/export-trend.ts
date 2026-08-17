export const EXPORT_TREND_GRAPH_POINT_COUNT = 5;

export function exportTrendGraphValues(values: readonly number[]): number[] {
  return values.slice(-EXPORT_TREND_GRAPH_POINT_COUNT);
}
