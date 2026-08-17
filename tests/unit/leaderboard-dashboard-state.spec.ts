import { expect, test } from "@playwright/test";
import {
  createCategoryDraft,
  currentSnapshotFromDraft,
  ensureCategoryDrafts,
  snapshotKey,
} from "../../src/lib/leaderboard/dashboard-state";
import { DEFAULT_SPEC } from "../../src/lib/leaderboard/schema";

test("ensureCategoryDrafts fills newly added category drafts without copying running mileage data", () => {
  const runningDraft = createCategoryDraft("running", {
    seasonYear: "2026",
    weekNumber: "31",
    spec: {
      ...DEFAULT_SPEC,
      athletes: [{ id: "athlete-1", name: "Runner One", value: 42 }],
      metric: "distance_km",
      totalOverride: 42,
      trendValues: [40, 42],
    },
  });

  const drafts = ensureCategoryDrafts({ running: runningDraft });

  expect(drafts.running.spec.athletes).toEqual([{ id: "athlete-1", name: "Runner One", value: 42 }]);
  expect(drafts.running.spec.metric).toBe("distance_km");
  expect(drafts.running_elevation_gain.projectId).toBe("altruist-sehat-running_elevation_gain");
  expect(drafts.running_elevation_gain.templateId).toBe("running_elevation_gain");
  expect(drafts.running_elevation_gain.spec.metric).toBe("elevation_m");
  expect(drafts.running_elevation_gain.spec.athletes).toEqual([]);
  expect(drafts.running_elevation_gain.spec.totalOverride).toBeUndefined();
  expect(drafts.running_elevation_gain.spec.trendValues).toEqual([]);
});

test("running distance and elevation gain drafts produce separate project and snapshot identities", () => {
  const runningDraft = createCategoryDraft("running", {
    seasonYear: "2026",
    weekNumber: "31",
  });
  const elevationDraft = createCategoryDraft("running_elevation_gain", {
    seasonYear: "2026",
    weekNumber: "31",
  });

  expect(runningDraft.projectId).toBe("altruist-sehat-running");
  expect(elevationDraft.projectId).toBe("altruist-sehat-running_elevation_gain");
  expect(runningDraft.projectId).not.toBe(elevationDraft.projectId);

  expect(snapshotKey(currentSnapshotFromDraft(runningDraft))).toBe("2026:31:running_weekly_mileage");
  expect(snapshotKey(currentSnapshotFromDraft(elevationDraft))).toBe("2026:31:running_elevation_gain");
  expect(snapshotKey(currentSnapshotFromDraft(runningDraft))).not.toBe(snapshotKey(currentSnapshotFromDraft(elevationDraft)));
});
