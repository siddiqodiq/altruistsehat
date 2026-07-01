"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import {
  BumpChart,
  type CategorySummary,
  CategorySwitch,
  EmptyState,
  LeaderboardTable,
  LeaderboardStoryHero,
  MovementNarrative,
  WeekTabs,
  chartDataFromSnapshots,
} from "./LeaderboardUi";
import { resolveMetricTotal } from "@/lib/leaderboard/metrics";
import {
  LEADERBOARD_CATEGORIES,
  filterSnapshotsByCategory,
  normalizeLeaderboardCategory,
  templateIdForCategory,
  type LeaderboardCategoryId,
} from "@/lib/leaderboard/categories";
import {
  DEFAULT_DRAFT,
  normalizeCategoryProjectState,
  currentSnapshotFromDraft,
  deriveDashboardSpec,
  snapshotKey,
} from "@/lib/leaderboard/dashboard-state";
import { specWithDatabaseAthletePhotos } from "@/lib/leaderboard/export-client";
import { buildLeaderboardStory } from "@/lib/leaderboard/story";
import type { LeaderboardSpec } from "@/lib/leaderboard/types";
import {
  LeaderboardWeekSnapshotSchema,
  compareSnapshotsByWeekAsc,
  compareSnapshotsByWeekDesc,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";
import { lookupAthletesByName } from "@/lib/athletes/client-cache";
import type { AthleteRecord } from "@/lib/athletes/types";

function emptySpecForCategory(categoryId: LeaderboardCategoryId): LeaderboardSpec {
  return {
    ...deriveDashboardSpec(DEFAULT_DRAFT.spec, DEFAULT_DRAFT.seasonYear, DEFAULT_DRAFT.weekNumber, templateIdForCategory(categoryId)),
    athletes: [],
    trendValues: [],
    previousWeekTotal: undefined,
  };
}

export function LeaderboardPublicPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projectDrafts, setProjectDrafts] = useState<Partial<Record<LeaderboardCategoryId, ReturnType<typeof normalizeCategoryProjectState>>>>({});
  const [snapshots, setSnapshots] = useState<LeaderboardWeekSnapshot[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<LeaderboardCategoryId>(() =>
    normalizeLeaderboardCategory(searchParams.get("category")),
  );
  const [selectedSnapshotKey, setSelectedSnapshotKey] = useState("");
  const [, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlightedAthleteKey, setHighlightedAthleteKey] = useState<string | null>(null);
  const [photoEnrichedSpec, setPhotoEnrichedSpec] = useState<{ key: string; spec: LeaderboardSpec } | null>(null);

  async function loadLeaderboard() {
    setLoading(true);
    setLoadError(null);
    try {
      const [snapshotResponse, ...projectResponses] = await Promise.all([
        fetch("/api/leaderboard/week-snapshots", { headers: { Accept: "application/json" } }),
        ...LEADERBOARD_CATEGORIES.map((category) =>
          fetch(`/api/leaderboard/projects/latest?category=${category.id}`, { headers: { Accept: "application/json" } }),
        ),
      ]);

      const nextDrafts: Partial<Record<LeaderboardCategoryId, ReturnType<typeof normalizeCategoryProjectState>>> = {};
      await Promise.all(
        projectResponses.map(async (response, index) => {
          if (!response.ok) {
            return;
          }

          const category = LEADERBOARD_CATEGORIES[index];
          const payload = (await response.json().catch(() => null)) as { project?: unknown } | null;
          const project = normalizeCategoryProjectState(payload?.project, category.id);
          if (project) {
            nextDrafts[category.id] = project;
          }
        }),
      );
      setProjectDrafts(nextDrafts);

      let parsedSnapshots: LeaderboardWeekSnapshot[] = [];
      if (snapshotResponse.ok) {
        const payload = (await snapshotResponse.json().catch(() => null)) as { snapshots?: unknown[] } | null;
        parsedSnapshots = (payload?.snapshots ?? [])
          .map((snapshot) => LeaderboardWeekSnapshotSchema.safeParse(snapshot))
          .filter((result): result is ReturnType<typeof LeaderboardWeekSnapshotSchema.safeParse> & { success: true } => result.success)
          .map((result) => result.data);
        setSnapshots(parsedSnapshots);
      } else {
        setSnapshots([]);
        setLoadError("Database leaderboard belum siap. Menampilkan draft tersimpan jika tersedia.");
      }

      const selectedCategorySnapshots = filterSnapshotsByCategory(parsedSnapshots, selectedCategory).sort(compareSnapshotsByWeekAsc);
      const selectedFallback = nextDrafts[selectedCategory] ? currentSnapshotFromDraft(nextDrafts[selectedCategory]) : undefined;
      const initialSnapshot = selectedCategorySnapshots[selectedCategorySnapshots.length - 1] ?? selectedFallback;
      setSelectedSnapshotKey((current) => current || (initialSnapshot ? snapshotKey(initialSnapshot) : ""));
    } catch {
      setLoadError("Dashboard belum bisa terhubung ke database leaderboard.");
      setProjectDrafts({});
      setSnapshots([]);
      setSelectedSnapshotKey("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  useEffect(() => {
    const category = normalizeLeaderboardCategory(searchParams.get("category"));
    setSelectedCategory(category);
  }, [searchParams]);

  const orderedSnapshots = useMemo(
    () =>
      snapshots
        .slice()
        .sort(compareSnapshotsByWeekDesc),
    [snapshots],
  );
  const categorySnapshots = useMemo(
    () => filterSnapshotsByCategory(orderedSnapshots, selectedCategory).sort(compareSnapshotsByWeekAsc),
    [orderedSnapshots, selectedCategory],
  );
  const categorySummaries = useMemo(() => {
    const summaries: Partial<Record<LeaderboardCategoryId, CategorySummary>> = {};

    LEADERBOARD_CATEGORIES.forEach((category) => {
      const categoryHistory = filterSnapshotsByCategory(orderedSnapshots, category.id).sort(compareSnapshotsByWeekAsc);
      const projectDraft = projectDrafts[category.id];
      const fallback = projectDraft ? currentSnapshotFromDraft(projectDraft) : undefined;
      const latest = categoryHistory[categoryHistory.length - 1] ?? fallback;

      summaries[category.id] = latest
        ? {
            athleteCount: latest.spec.athletes.length,
            metric: latest.spec.metric,
            total: latest.total ?? resolveMetricTotal(latest.spec.athletes, latest.spec.totalOverride),
          }
        : {
            athleteCount: 0,
            metric: category.metric,
            total: 0,
          };
    });

    return summaries;
  }, [orderedSnapshots, projectDrafts]);
  const fallbackSnapshot = useMemo(
    () => (projectDrafts[selectedCategory] ? currentSnapshotFromDraft(projectDrafts[selectedCategory]) : undefined),
    [projectDrafts, selectedCategory],
  );
  const emptySelectedSpec = useMemo(() => emptySpecForCategory(selectedCategory), [selectedCategory]);
  const visibleSnapshots = useMemo(
    () => (categorySnapshots.length ? categorySnapshots : fallbackSnapshot ? [fallbackSnapshot] : []),
    [categorySnapshots, fallbackSnapshot],
  );
  const selectedSnapshot =
    visibleSnapshots.find((snapshot) => snapshotKey(snapshot) === selectedSnapshotKey) ?? visibleSnapshots[visibleSnapshots.length - 1];
  const selectedSpec = selectedSnapshot?.spec ?? emptySelectedSpec;
  const selectedSpecPhotoKey = useMemo(
    () =>
      JSON.stringify({
        category: selectedCategory,
        dateRange: selectedSpec.dateRange,
        metric: selectedSpec.metric,
        weekNumber: selectedSpec.weekNumber,
        athletes: selectedSpec.athletes.map((athlete) => ({
          avatarDataUrl: athlete.avatarDataUrl ?? "",
          id: athlete.id,
          name: athlete.name,
          podiumPhotoUrl: athlete.podiumPhotoUrl ?? "",
          profilePhotoUrl: athlete.profilePhotoUrl ?? "",
        })),
      }),
    [selectedCategory, selectedSpec],
  );
  const displaySpec = photoEnrichedSpec?.key === selectedSpecPhotoKey ? photoEnrichedSpec.spec : selectedSpec;
  const chartSnapshots = useMemo(() => visibleSnapshots, [visibleSnapshots]);
  const chartData = useMemo(() => chartDataFromSnapshots(chartSnapshots), [chartSnapshots]);
  const story = useMemo(() => buildLeaderboardStory(selectedSnapshot, visibleSnapshots), [selectedSnapshot, visibleSnapshots]);
  const selectedTotal = selectedSnapshot?.total ?? resolveMetricTotal(selectedSpec.athletes, selectedSpec.totalOverride);
  const selectedCategoryConfig =
    LEADERBOARD_CATEGORIES.find((category) => category.id === selectedCategory) ?? LEADERBOARD_CATEGORIES[0];
  const totalLabel = selectedCategory === "weight_training" ? "Total Time" : "Total Mileage";

  useEffect(() => {
    setSelectedSnapshotKey((current) => {
      if (visibleSnapshots.some((snapshot) => snapshotKey(snapshot) === current)) {
        return current;
      }

      return visibleSnapshots.length ? snapshotKey(visibleSnapshots[visibleSnapshots.length - 1]) : "";
    });
  }, [visibleSnapshots]);

  async function specWithLatestDatabasePhotos(spec: LeaderboardSpec) {
    const names = spec.athletes.map((athlete) => athlete.name).filter(Boolean);
    if (!names.length) {
      return spec;
    }

    const lookup = await lookupAthletesByName(names);
    const databaseAthletes = Array.from(lookup.values()).filter((athlete): athlete is AthleteRecord => Boolean(athlete));
    return specWithDatabaseAthletePhotos(spec, databaseAthletes);
  }

  useEffect(() => {
    let cancelled = false;
    setPhotoEnrichedSpec({ key: selectedSpecPhotoKey, spec: selectedSpec });

    if (!selectedSpec.athletes.length) {
      return () => {
        cancelled = true;
      };
    }

    specWithLatestDatabasePhotos(selectedSpec)
      .then((spec) => {
        if (!cancelled) {
          setPhotoEnrichedSpec({
            key: selectedSpecPhotoKey,
            spec,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhotoEnrichedSpec({ key: selectedSpecPhotoKey, spec: selectedSpec });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSpec, selectedSpecPhotoKey]);

  function handleCategorySelect(category: LeaderboardCategoryId) {
    setSelectedCategory(category);
    const query = new URLSearchParams(searchParams.toString());
    query.set("category", category);
    router.replace(`/leaderboard?${query.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-screen flex-col bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <main className="flex-1">
        <Navbar />
        <LeaderboardStoryHero
        athleteCount={displaySpec.athletes.length}
        categoryLabel={selectedCategoryConfig.label}
        spec={displaySpec}
        story={story}
        total={selectedTotal}
        totalLabel={totalLabel}
      />

      <section className="mx-auto w-full max-w-[1600px] px-4 pb-20 sm:px-6 lg:px-8">
        <CategorySwitch summaries={categorySummaries} selectedCategory={selectedCategory} onSelect={handleCategorySelect} />

        <div className="mt-8 grid gap-8">
          {loadError ? (
            <div className="rounded-2xl border border-secondary-clay/40 bg-secondary-clay/15 px-4 py-3 text-sm font-semibold text-primary-brown dark:border-secondary-clay/30 dark:bg-secondary-clay/10 dark:text-secondary-sand">
              {loadError}
            </div>
          ) : null}

          <section>
            {visibleSnapshots.length && selectedSnapshot ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_300px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <BumpChart
                  data={chartData}
                  highlightedKey={highlightedAthleteKey}
                  leaderboard={
                    <LeaderboardTable
                      embedded
                      highlightedKey={highlightedAthleteKey}
                      movementByAthleteKey={story.movementByAthleteKey}
                      onAthleteHover={setHighlightedAthleteKey}
                      periodNavigation={
                        <WeekTabs selectedKey={snapshotKey(selectedSnapshot)} snapshots={visibleSnapshots} onSelect={setSelectedSnapshotKey} />
                      }
                      snapshots={visibleSnapshots}
                      spec={displaySpec}
                    />
                  }
                  onHighlightChange={setHighlightedAthleteKey}
                />
                <MovementNarrative data={chartData} metric={selectedSpec.metric} story={story} />
              </div>
            ) : (
              <EmptyState title="Belum ada aktivitas minggu ini." message={`${selectedCategoryConfig.label} belum memiliki data leaderboard.`} />
            )}
          </section>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  );
}
