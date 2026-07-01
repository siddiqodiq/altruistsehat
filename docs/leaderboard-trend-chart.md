# Leaderboard Trend Chart

The public leaderboard trend is a true bump chart. Weekly metric values are transformed into rankings first, then the chart visualizes rank movement across weeks.

## Design decisions

- Default focus is Top 5 to keep the story readable for community members.
- Top 10, Top 20, and All modes are available for deeper exploration.
- Search selects an athlete and keeps that athlete visible even outside the current focus mode.
- Hover and search use spotlight opacity so one athlete can be followed without visual clutter.
- Labels are intentionally sparse: Top 5, selected athlete, and hovered athlete only.
- Podium zones use subtle gold, silver, and bronze shading to communicate leaderboard tiers without adding noise.
- Top Movers and Biggest Drops are calculated from the latest week versus the previous week.
- Horizontal zoom and drag-to-pan support dense week ranges on mobile and desktop.

## Performance notes

- Ranking transformation is isolated in `src/lib/leaderboard/bump-chart.ts`.
- Derived chart data should be memoized by the caller.
- Default rendering is limited to five athletes, while All mode is opt-in for heavier views.
- The chart uses lightweight SVG primitives and avoids charting-library runtime overhead.
