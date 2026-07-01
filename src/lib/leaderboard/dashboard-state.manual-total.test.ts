import assert from "node:assert/strict";
import test from "node:test";
import { createInitialProjectState } from "./project-state";
import { DEFAULT_SPEC } from "./schema";
import { currentSnapshotFromDraft } from "./dashboard-state";

test("currentSnapshotFromDraft stores the admin-entered weekly total", () => {
  const spec = {
    ...DEFAULT_SPEC,
    totalOverride: 250,
    athletes: [
      { id: "athlete-1", name: "Top One", value: 100 },
      { id: "athlete-2", name: "Top Two", value: 75 },
    ],
  };
  const draft = createInitialProjectState({
    spec,
    seasonYear: "2026",
    weekNumber: "1",
    templateId: "running_weekly_mileage",
  });

  assert.equal(currentSnapshotFromDraft(draft).total, 250);
});

test("currentSnapshotFromDraft falls back to the ranked athlete total when no weekly total is entered", () => {
  const draft = createInitialProjectState({
    spec: {
      ...DEFAULT_SPEC,
      athletes: [
        { id: "athlete-1", name: "Top One", value: 100 },
        { id: "athlete-2", name: "Top Two", value: 75 },
      ],
    },
    seasonYear: "2026",
    weekNumber: "1",
    templateId: "running_weekly_mileage",
  });

  assert.equal(currentSnapshotFromDraft(draft).total, 175);
});
