"use client";

/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Footer from "@/components/Footer";
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
  categoryConfigForId,
  categoryForSportMetric,
  filterSnapshotsByCategory,
  leaderboardSportOptions,
  metricOptionsForSport,
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
import type { LeaderboardSpec, MetricType, SportType } from "@/lib/leaderboard/types";
import {
  LeaderboardWeekSnapshotSchema,
  compareSnapshotsByWeekAsc,
  compareSnapshotsByWeekDesc,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";
import { lookupAthletesByName } from "@/lib/athletes/client-cache";
import type { AthleteRecord } from "@/lib/athletes/types";
import { cn } from "@/lib/utils";

const DEFAULT_CHART_RANGE_WEEKS = 4;
const CHART_RANGE_OPTIONS = [
  { label: "1 Bulan", value: DEFAULT_CHART_RANGE_WEEKS },
  { label: "2 Bulan", value: 8 },
  { label: "Semua", value: "all" },
] as const;

type ChartRangeWeeks = (typeof CHART_RANGE_OPTIONS)[number]["value"];

function ChartRangeOptionLabel({ label }: { label: string }) {
  const [firstWord, ...remainingWords] = label.split(" ");
  if (!remainingWords.length) {
    return label;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{firstWord}</span>
      <span>{remainingWords.join(" ")}</span>
    </span>
  );
}

function emptySpecForCategory(categoryId: LeaderboardCategoryId): LeaderboardSpec {
  return {
    ...deriveDashboardSpec(DEFAULT_DRAFT.spec, DEFAULT_DRAFT.seasonYear, DEFAULT_DRAFT.weekNumber, templateIdForCategory(categoryId)),
    athletes: [],
    trendValues: [],
    previousWeekTotal: undefined,
  };
}

function totalLabelForMetric(metric: MetricType): string {
  if (metric === "time_minutes") {
    return "Total Time";
  }

  if (metric === "elevation_m") {
    return "Total Elevation Gain";
  }

  return "Total Mileage";
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [highlightedAthleteKey, setHighlightedAthleteKey] = useState<string | null>(null);
  const [chartRangeWeeks, setChartRangeWeeks] = useState<ChartRangeWeeks>(DEFAULT_CHART_RANGE_WEEKS);
  const [photoEnrichedSpec, setPhotoEnrichedSpec] = useState<{ key: string; spec: LeaderboardSpec } | null>(null);
  const [photoEnrichedSnapshots, setPhotoEnrichedSnapshots] = useState<{ key: string; snapshots: LeaderboardWeekSnapshot[] } | null>(null);
  const sportOptions = useMemo(() => leaderboardSportOptions(), []);

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
        setLoadError("Leaderboard belum tampil penuh. Kami tampilkan data yang tersedia dulu.");
      }

      const selectedCategorySnapshots = filterSnapshotsByCategory(parsedSnapshots, selectedCategory).sort(compareSnapshotsByWeekAsc);
      const selectedFallback = nextDrafts[selectedCategory] ? currentSnapshotFromDraft(nextDrafts[selectedCategory]) : undefined;
      const initialSnapshot = selectedCategorySnapshots[selectedCategorySnapshots.length - 1] ?? selectedFallback;
      setSelectedSnapshotKey((current) => current || (initialSnapshot ? snapshotKey(initialSnapshot) : ""));
    } catch {
      setLoadError("Leaderboard belum bisa dibuka penuh. Coba segarkan halaman sebentar lagi.");
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
  const visibleSnapshotsPhotoKey = useMemo(
    () =>
      JSON.stringify(
        visibleSnapshots.map((snapshot) => ({
          key: snapshotKey(snapshot),
          athletes: snapshot.spec.athletes.map((athlete) => ({
            avatarDataUrl: athlete.avatarDataUrl ?? "",
            id: athlete.id,
            name: athlete.name,
            podiumPhotoUrl: athlete.podiumPhotoUrl ?? "",
            profilePhotoUrl: athlete.profilePhotoUrl ?? "",
          })),
        })),
      ),
    [visibleSnapshots],
  );
  const chartSnapshots = useMemo(() => {
    if (photoEnrichedSnapshots?.key === visibleSnapshotsPhotoKey) {
      return photoEnrichedSnapshots.snapshots;
    }

    return visibleSnapshots.map((snapshot) =>
      selectedSnapshot && snapshotKey(snapshot) === snapshotKey(selectedSnapshot)
        ? { ...snapshot, spec: displaySpec }
        : snapshot,
    );
  }, [displaySpec, photoEnrichedSnapshots, selectedSnapshot, visibleSnapshots, visibleSnapshotsPhotoKey]);
  const chartSnapshotsForRange = useMemo(() => {
    if (chartRangeWeeks === "all") {
      return chartSnapshots;
    }

    const selectedIndex = selectedSnapshot
      ? chartSnapshots.findIndex((snapshot) => snapshotKey(snapshot) === snapshotKey(selectedSnapshot))
      : -1;
    const snapshotsUntilSelected = chartSnapshots.slice(0, selectedIndex >= 0 ? selectedIndex + 1 : chartSnapshots.length);
    return snapshotsUntilSelected.slice(-chartRangeWeeks);
  }, [chartRangeWeeks, chartSnapshots, selectedSnapshot]);
  const chartData = useMemo(
    () => chartDataFromSnapshots(chartSnapshotsForRange, chartRangeWeeks === "all" ? chartSnapshotsForRange.length : chartRangeWeeks),
    [chartRangeWeeks, chartSnapshotsForRange],
  );
  const chartRangeLabel = chartRangeWeeks === DEFAULT_CHART_RANGE_WEEKS
    ? "1 Bulan Terakhir"
    : chartRangeWeeks === "all"
      ? "Semua Histori"
      : "2 Bulan Terakhir";
  const story = useMemo(() => buildLeaderboardStory(selectedSnapshot, visibleSnapshots), [selectedSnapshot, visibleSnapshots]);
  const selectedTotal = selectedSnapshot?.total ?? resolveMetricTotal(selectedSpec.athletes, selectedSpec.totalOverride);
  const selectedCategoryConfig = categoryConfigForId(selectedCategory);
  const metricOptions = useMemo(() => metricOptionsForSport(selectedCategoryConfig.sportType), [selectedCategoryConfig.sportType]);
  const totalLabel = totalLabelForMetric(selectedSpec.metric);

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

    const lookup = await lookupAthletesByName(names, { forceRefresh: true });
    const databaseAthletes = Array.from(lookup.values()).filter((athlete): athlete is AthleteRecord => Boolean(athlete));
    return specWithDatabaseAthletePhotos(spec, databaseAthletes);
  }

  async function snapshotsWithLatestDatabasePhotos(nextSnapshots: LeaderboardWeekSnapshot[]) {
    const names = nextSnapshots.flatMap((snapshot) => snapshot.spec.athletes.map((athlete) => athlete.name)).filter(Boolean);
    if (!names.length) {
      return nextSnapshots;
    }

    const lookup = await lookupAthletesByName(names, { forceRefresh: true });
    const databaseAthletes = Array.from(lookup.values()).filter((athlete): athlete is AthleteRecord => Boolean(athlete));
    if (!databaseAthletes.length) {
      return nextSnapshots;
    }

    return nextSnapshots.map((snapshot) => ({
      ...snapshot,
      spec: specWithDatabaseAthletePhotos(snapshot.spec, databaseAthletes),
    }));
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

  useEffect(() => {
    let cancelled = false;
    setPhotoEnrichedSnapshots({ key: visibleSnapshotsPhotoKey, snapshots: visibleSnapshots });

    if (!visibleSnapshots.length) {
      return () => {
        cancelled = true;
      };
    }

    snapshotsWithLatestDatabasePhotos(visibleSnapshots)
      .then((nextSnapshots) => {
        if (!cancelled) {
          setPhotoEnrichedSnapshots({
            key: visibleSnapshotsPhotoKey,
            snapshots: nextSnapshots,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPhotoEnrichedSnapshots({ key: visibleSnapshotsPhotoKey, snapshots: visibleSnapshots });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [visibleSnapshots, visibleSnapshotsPhotoKey]);

  function handleCategorySelect(category: LeaderboardCategoryId) {
    setSelectedCategory(category);
    const query = new URLSearchParams(searchParams.toString());
    query.set("category", category);
    router.replace(`/leaderboard?${query.toString()}`, { scroll: false });
  }

  function handleSportSelect(sportType: SportType) {
    handleCategorySelect(categoryForSportMetric(sportType, selectedCategoryConfig.metric));
  }

  function handleMetricSelect(category: LeaderboardCategoryId) {
    handleCategorySelect(category);
  }

  const chartRangeFilter = (
    <div
      aria-label="Filter rentang chart leaderboard"
      className="inline-flex rounded-xl border border-secondary-sand/70 bg-white/80 p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-950/80"
      role="group"
    >
      {CHART_RANGE_OPTIONS.map((option) => {
        const active = option.value === chartRangeWeeks;

        return (
          <button
            aria-label={option.label}
            aria-pressed={active}
            className={cn(
              "h-9 min-w-[5rem] rounded-lg px-4 text-[13px] font-extrabold leading-none transition",
              active
                ? "bg-primary-brown text-white shadow-[0_8px_18px_rgb(90,46,23,0.18)]"
                : "text-primary-charcoal/58 hover:bg-secondary-sand/35 dark:text-gray-300 dark:hover:bg-zinc-800",
            )}
            key={option.label}
            onClick={() => setChartRangeWeeks(option.value)}
            type="button"
          >
            <ChartRangeOptionLabel label={option.label} />
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <main className="flex-1" id="main-content">
        <LeaderboardStoryHero
        athleteCount={displaySpec.athletes.length}
        categoryLabel={selectedCategoryConfig.label}
        spec={displaySpec}
        story={story}
        total={selectedTotal}
        totalLabel={totalLabel}
      />

      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 pb-20">
        <CategorySwitch
          hasError={!loading && Boolean(loadError)}
          isLoading={loading}
          metrics={metricOptions}
          onMetricSelect={handleMetricSelect}
          onSportSelect={handleSportSelect}
          selectedCategory={selectedCategory}
          sportOptions={sportOptions}
          summaries={categorySummaries}
        />

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
                  actionSlot={chartRangeFilter}
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
                  rangeLabel={chartRangeLabel}
                />
                <MovementNarrative metric={selectedSpec.metric} story={story} />
              </div>
            ) : (
              <EmptyState title="Belum ada aktivitas minggu ini." message={`${selectedCategoryConfig.label} belum memiliki data leaderboard.`} />
            )}
          </section>
        </div>
      </section>
      </main>

      <Footer />
    </>
  );
}
