import { calculateWeeklyComparison, formatMetricDisplayParts, formatMetricValue, resolveMetricTotal } from "@/lib/leaderboard/metrics";
import { resolveSportPodiumPhotoUrl } from "@/lib/athletes/sport-podium-photos";
import {
  compactCutoutBackdropStyle,
  compactPhotoForegroundAdjustmentStyle,
  resolveAthletePhotoAdjustment,
} from "@/lib/leaderboard/photo-adjustments";
import { buildLeaderboardRows } from "@/lib/leaderboard/ranking";
import { storyDisplayName, storyPodiumNameLines } from "@/lib/leaderboard/story-display-name";
import {
  OUTPUT_DIMENSIONS,
  SPORT_OPTIONS,
  type ExportLayoutMode,
  type ExportPhotoAdjustment,
  type LeaderboardSpec,
  type OutputFormat,
  type RankedAthlete,
  type SportType,
  type ThemeId,
} from "@/lib/leaderboard/types";
import { initialsForName } from "@/lib/leaderboard/images";
import { deriveCurrentTrendTotal, derivePreviousWeekTotal } from "@/lib/leaderboard/templates";
import { cn } from "@/lib/utils";
import { Bike, Dumbbell, Footprints, Mountain, PersonStanding, Waves, type LucideIcon } from "lucide-react";

interface LeaderboardCanvasProps {
  format: OutputFormat;
  spec: LeaderboardSpec;
}

interface PosterTheme {
  canvas: string;
  text: string;
  muted: string;
  faint: string;
  accent: string;
  accent2: string;
  positive: string;
  negative: string;
  panel: string;
  panelStrong: string;
  line: string;
}

const themes: Record<ThemeId, PosterTheme> = {
  altruist_dark: {
    canvas: "bg-[#050505] text-white",
    text: "text-white",
    muted: "text-white/66",
    faint: "text-white/42",
    accent: "text-[#FFC400]",
    accent2: "text-[#FFB000]",
    positive: "text-[#7CFF4D]",
    negative: "text-[#FF4D4D]",
    panel: "bg-white/[0.045] border-white/14",
    panelStrong: "bg-[#10100e]/92 border-[#FFC400]/25",
    line: "border-white/12",
  },
  strava_orange: {
    canvas: "bg-[#080504] text-white",
    text: "text-white",
    muted: "text-white/66",
    faint: "text-white/42",
    accent: "text-[#FFC400]",
    accent2: "text-[#FC4C02]",
    positive: "text-[#7CFF4D]",
    negative: "text-[#FF4D4D]",
    panel: "bg-[#FC4C02]/[0.07] border-[#FC4C02]/24",
    panelStrong: "bg-[#130806]/94 border-[#FC4C02]/35",
    line: "border-white/12",
  },
  minimal_white: {
    canvas: "bg-[#f6f2e8] text-[#111111]",
    text: "text-[#111111]",
    muted: "text-black/62",
    faint: "text-black/42",
    accent: "text-[#8c6500]",
    accent2: "text-[#111111]",
    positive: "text-[#3f8f14]",
    negative: "text-[#d52f2f]",
    panel: "bg-white/72 border-black/12",
    panelStrong: "bg-white/88 border-[#8c6500]/22",
    line: "border-black/12",
  },
};

const gold = "#FFC400";
const gold2 = "#FFB000";
const storyAccent = "#FFC72C";
const officialStoryLogoSrc = "/altruist-sehat-logo.png";
const stravaSourceLogoSrc = "/strava-source-logo.webp";

interface StorySportIconConfig {
  Icon: LucideIcon;
  id: SportType;
}

function getStorySportIcon(sportType: string): StorySportIconConfig {
  const matched = SPORT_OPTIONS.find((option) => option.toLowerCase() === sportType.toLowerCase()) ?? "Running";
  const iconBySport: Record<SportType, LucideIcon> = {
    Running: Footprints,
    Riding: Bike,
    Cycling: Bike,
    Swimming: Waves,
    Gym: Dumbbell,
    "Weight Training": Dumbbell,
    Walking: PersonStanding,
    "Trail Running": Mountain,
    Hiking: Footprints,
  };

  return { Icon: iconBySport[matched], id: matched };
}

function previousWeekLabel(weekNumber: string): string {
  const match = weekNumber.match(/(?:week\s*)?(\d+)/i);

  if (!match) {
    return "VS LAST WEEK";
  }

  const week = Number(match[1]);
  if (!Number.isFinite(week) || week <= 1) {
    return "VS LAST WEEK";
  }

  return `VS WEEK ${week - 1}`;
}

function formatWeekLabel(weekNumber: string) {
  const clean = weekNumber.trim();
  if (/^\d+$/.test(clean)) {
    return `WEEK ${clean}`;
  }

  return clean;
}

function storyNameClass(name: string, size: "podium" | "table") {
  if (size === "table") {
    if (name.length > 34) {
      return "text-[20px]";
    }

    return name.length > 24 ? "text-[23px]" : "text-[27px]";
  }

  const longestLine = Math.max(...storyPodiumNameLines(name).map((line) => line.length));

  if (longestLine > 17) {
    return "text-[15px] leading-[1.12] tracking-[0.035em]";
  }

  if (longestLine > 14) {
    return "text-[17px] leading-[1.12] tracking-[0.04em]";
  }

  if (longestLine > 11) {
    return "text-[21px] leading-[1.1] tracking-[0.05em]";
  }

  if (name.length > 18) {
    return "text-[24px] leading-[1.08] tracking-[0.06em]";
  }

  if (name.length > 17) {
    return "text-[27px] leading-[1.08] tracking-[0.065em]";
  }

  return "text-[30px] leading-[1.05] tracking-[0.07em]";
}

function splitMetricValue(
  value: number,
  metric: LeaderboardSpec["metric"],
  options: Parameters<typeof formatMetricValue>[2] = {},
) {
  const parts = formatMetricDisplayParts(value, metric, options);
  return { number: parts.primary, unit: parts.accent };
}

function normalizedImageUrl(value?: string) {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function resolveAthleteImage(...values: Array<string | undefined>) {
  for (const value of values) {
    const normalized = normalizedImageUrl(value);
    if (normalized) {
      return normalized;
    }
  }
  return undefined;
}

function resolveAthletePodiumImage(athlete: RankedAthlete, spec: LeaderboardSpec) {
  return resolveSportPodiumPhotoUrl({
    sportPodiumPhotoUrls: athlete.sportPodiumPhotoUrls,
    podiumPhotoUrl: athlete.podiumPhotoUrl,
    sportType: spec.sportType,
  });
}

function exportLayoutModeForSpec(spec: LeaderboardSpec): ExportLayoutMode {
  if (spec.exportLayoutMode) {
    return spec.exportLayoutMode;
  }

  if (spec.athletes.length > 5) {
    return "podiumTop10";
  }

  return `top${Math.max(1, Math.min(5, spec.athletes.length))}` as ExportLayoutMode;
}

function photoAdjustmentForAthlete(spec: LeaderboardSpec, athlete: RankedAthlete): ExportPhotoAdjustment {
  const layoutMode = exportLayoutModeForSpec(spec);
  return resolveAthletePhotoAdjustment({
    athlete,
    exportPhotoAdjustments: spec.exportPhotoAdjustments,
    layoutMode,
  });
}

function photoAdjustmentData(adjustment: ExportPhotoAdjustment) {
  return `zoom:${adjustment.zoom.toFixed(2)};x:${adjustment.x};y:${adjustment.y}`;
}

function adjustmentObjectPosition(adjustment: ExportPhotoAdjustment) {
  const x = Math.min(100, Math.max(0, 50 + adjustment.x));
  const y = Math.min(100, Math.max(0, 50 + adjustment.y));
  return `${x}% ${y}%`;
}

function podiumPhotoAdjustmentStyle(adjustment: ExportPhotoAdjustment) {
  return {
    objectPosition: adjustmentObjectPosition(adjustment),
    transform: `scale(${1.04 * Math.max(1, adjustment.zoom)})`,
    transformOrigin: "center center",
  };
}

type StoryPodiumMedalTone = "gold" | "silver" | "bronze";

function storyPodiumMedalTone(rank: number): StoryPodiumMedalTone {
  if (rank === 1) {
    return "gold";
  }

  if (rank === 2) {
    return "silver";
  }

  return "bronze";
}

function storyPodiumMedalBackplateStyle(tone: StoryPodiumMedalTone) {
  const styles: Record<StoryPodiumMedalTone, { background: string; boxShadow: string }> = {
    gold: {
      background:
        "radial-gradient(circle at 18% 0%, rgba(255,217,113,0.58) 0%, rgba(255,199,44,0.26) 30%, rgba(255,199,44,0) 58%), linear-gradient(155deg, rgba(255,217,113,0.46) 0%, rgba(197,138,0,0.34) 30%, rgba(24,18,5,0.18) 64%, rgba(5,5,5,0.06) 100%), linear-gradient(to right, rgba(255,199,44,0.12), rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.52) 100%)",
      boxShadow: "inset 0 0 72px rgba(255,199,44,0.18)",
    },
    silver: {
      background:
        "radial-gradient(circle at 18% 0%, rgba(245,245,245,0.52) 0%, rgba(212,212,216,0.24) 31%, rgba(212,212,216,0) 58%), linear-gradient(155deg, rgba(245,245,245,0.42) 0%, rgba(113,113,122,0.30) 31%, rgba(22,22,22,0.20) 64%, rgba(5,5,5,0.06) 100%), linear-gradient(to right, rgba(245,245,245,0.10), rgba(0,0,0,0.22) 58%, rgba(0,0,0,0.52) 100%)",
      boxShadow: "inset 0 0 66px rgba(245,245,245,0.14)",
    },
    bronze: {
      background:
        "radial-gradient(circle at 18% 0%, rgba(216,146,80,0.54) 0%, rgba(196,123,53,0.26) 32%, rgba(196,123,53,0) 58%), linear-gradient(155deg, rgba(216,146,80,0.44) 0%, rgba(138,79,32,0.33) 32%, rgba(23,13,8,0.20) 64%, rgba(5,5,5,0.06) 100%), linear-gradient(to right, rgba(196,123,53,0.12), rgba(0,0,0,0.24) 58%, rgba(0,0,0,0.54) 100%)",
      boxShadow: "inset 0 0 66px rgba(196,123,53,0.16)",
    },
  };

  return styles[tone];
}

function storySummaryNumberClass(number: string) {
  if (/\s/.test(number)) {
    return number.length > 6 ? "text-[70px]" : "text-[76px]";
  }

  if (number.length > 8) {
    return "text-[66px]";
  }

  if (number.length > 6) {
    return "text-[76px]";
  }

  if (number.length > 5) {
    return "text-[86px]";
  }

  return "text-[96px]";
}

function storyComparisonClass(comparison: string) {
  if (comparison.length > 7) {
    return "text-[44px]";
  }

  if (comparison.length > 5) {
    return "text-[48px]";
  }

  return "text-[54px]";
}

function storyDateClass(dateRange: string) {
  if (dateRange.length > 28) {
    return "text-[16px]";
  }

  if (dateRange.length > 20) {
    return "text-[20px]";
  }

  return "text-[25px]";
}

function storyPodiumValueClass(number: string, isChampion: boolean) {
  if (isChampion) {
    if (number.length > 8) {
      return "text-[42px]";
    }

    if (number.length > 6) {
      return "text-[46px]";
    }

    return "text-[52px]";
  }

  if (number.length > 8) {
    return "text-[34px]";
  }

  if (number.length > 6) {
    return "text-[38px]";
  }

  return "text-[42px]";
}

function comparisonClassName(comparison: string, accentClassName: string, negativeClassName: string, neutralClassName: string) {
  if (comparison.startsWith("-")) {
    return negativeClassName;
  }

  if (comparison.startsWith("0") || comparison === "—") {
    return neutralClassName;
  }

  return accentClassName;
}

function PosterBackground({ themeId }: { themeId: ThemeId }) {
  const isMinimal = themeId === "minimal_white";

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" data-testid="sports-poster-background">
      <div
        className="absolute inset-0"
        style={{
          background: isMinimal
            ? "radial-gradient(circle at 50% 26%, rgba(255,196,0,0.22), transparent 32%), linear-gradient(180deg, #fbf7ee 0%, #ece5d6 100%)"
            : "radial-gradient(circle at 50% 34%, rgba(255,196,0,0.18), transparent 34%), radial-gradient(circle at 90% 4%, rgba(255,196,0,0.12), transparent 28%), #050505",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: isMinimal
            ? "radial-gradient(circle at center, transparent 44%, rgba(0,0,0,0.16) 100%)"
            : "radial-gradient(circle at center, transparent 42%, rgba(0,0,0,0.82) 100%)",
        }}
      />
      <div
        className="absolute left-[-160px] top-[210px] h-[2px] w-[1520px] rotate-[-16deg] opacity-35"
        style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }}
      />
      <div
        className="absolute bottom-[116px] right-[-250px] h-[4px] w-[880px] rotate-[-16deg] opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${gold2}, ${gold}, transparent)` }}
      />
      <div
        className="absolute bottom-[74px] right-[-300px] h-[2px] w-[1020px] rotate-[-16deg] opacity-30"
        style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }}
      />
      <div
        className="absolute bottom-[28px] right-[-300px] h-[1px] w-[1060px] rotate-[-16deg] opacity-20"
        style={{ background: `linear-gradient(90deg, transparent, ${gold}, transparent)` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(255,255,255,0.08),transparent_20%)] opacity-70" />
    </div>
  );
}

function LogoMark({ compact, spec, theme }: { compact: boolean; spec: LeaderboardSpec; theme: PosterTheme }) {
  return (
    <div className="flex items-center gap-6">
      <div
        className={cn(
          "relative grid shrink-0 place-items-center overflow-hidden rounded-[8px] border font-black",
          compact ? "size-[62px] text-[19px]" : "size-[78px] text-[24px]",
          theme.panel,
        )}
      >
        <div className="absolute inset-2 rounded-[7px] border border-current/20" />
        {spec.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Community logo" className="relative h-full w-full object-contain p-2" src={spec.logoDataUrl} />
        ) : (
          <span className={cn("relative italic", theme.accent)}>AS</span>
        )}
      </div>
      <div className={cn("w-[2px] bg-[#FFC400]", compact ? "h-[58px]" : "h-[72px]")} />
    </div>
  );
}

function AthleteCutout({
  athlete,
  compact,
  rank,
  spec,
}: {
  athlete: RankedAthlete;
  compact: boolean;
  rank: number;
  spec: LeaderboardSpec;
}) {
  const isChampion = rank === 1;
  const imageSrc = resolveAthleteImage(resolveAthletePodiumImage(athlete, spec), athlete.avatarDataUrl, athlete.profilePhotoUrl);
  const hasCutout = Boolean(imageSrc);
  const height = isChampion ? (compact ? "h-[216px]" : "h-[236px]") : compact ? "h-[186px]" : "h-[206px]";

  if (hasCutout) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt={`${athlete.name} athlete cutout`}
        className={cn("relative z-10 w-full object-contain drop-shadow-[0_26px_34px_rgba(0,0,0,0.68)]", height)}
        data-crop="transparent-cutout"
        data-testid={`athlete-cutout-rank-${rank}`}
        src={imageSrc}
      />
    );
  }

  return (
    <div
      className={cn(
        "relative z-10 mx-auto flex w-full max-w-[260px] flex-col items-center justify-end overflow-hidden",
        height,
      )}
      data-crop="editorial-fallback"
      data-testid={`athlete-cutout-rank-${rank}`}
    >
      <div
        className={cn(
          "absolute bottom-0 w-[72%] rounded-t-[48%] border border-white/12 bg-gradient-to-b from-[#343434] to-[#0c0c0c] shadow-[0_28px_42px_rgba(0,0,0,0.72)]",
          isChampion ? "h-[72%]" : "h-[66%]",
        )}
      />
      <div
        className={cn(
          "absolute rounded-full border border-white/15 bg-gradient-to-br from-[#585858] to-[#151515] shadow-[0_18px_28px_rgba(0,0,0,0.58)]",
          isChampion ? "top-[18%] size-[88px]" : "top-[22%] size-[78px]",
        )}
      />
      <div
        className={cn(
          "absolute grid place-items-center font-black italic text-white",
          isChampion ? "top-[22%] text-[28px]" : "top-[26%] text-[25px]",
        )}
      >
        {initialsForName(athlete.name)}
      </div>
    </div>
  );
}

function TrendGraph({ compact, values }: { compact: boolean; values: number[] }) {
  const points = values.length ? values : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = compact ? 280 : 340;
  const height = compact ? 96 : 118;
  const coordinates = points.map((value, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 30) - 15;
    return { x, y, value };
  });
  const path = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg aria-label="Performance trend graph" className="overflow-visible" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <filter id={`trend-glow-${compact ? "feed" : "story"}`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <polyline
        fill="none"
        filter={`url(#trend-glow-${compact ? "feed" : "story"})`}
        points={path}
        stroke={gold}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="7"
      />
      {coordinates.map(({ x, y, value }, index) => (
        <g key={`${value}-${index}`}>
          <line stroke={gold} strokeDasharray="3 7" strokeOpacity="0.35" strokeWidth="2" x1={x} x2={x} y1={y + 10} y2={height} />
          <circle cx={x} cy={y} fill="#050505" r="9" stroke={gold} strokeWidth="5" />
        </g>
      ))}
    </svg>
  );
}

function StoryBackground() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#050505]" data-testid="sports-poster-background">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#050505_0%,#0A0A0A_48%,#050505_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(255,255,255,0.07),transparent_24%)] opacity-80" />
      <div
        className="absolute right-[-120px] top-[-90px] h-[2px] w-[720px] rotate-[-59deg] opacity-35"
        style={{ background: `linear-gradient(90deg, transparent, ${storyAccent}, transparent)` }}
      />
      <div
        className="absolute right-[-84px] top-[-20px] h-[1px] w-[620px] rotate-[-59deg] opacity-22"
        style={{ background: `linear-gradient(90deg, transparent, ${storyAccent}, transparent)` }}
      />
      <div
        className="absolute bottom-[94px] right-[-210px] h-[4px] w-[820px] rotate-[-14deg] opacity-75"
        style={{ background: `linear-gradient(90deg, transparent, ${storyAccent}, ${storyAccent}, transparent)` }}
      />
      <div
        className="absolute bottom-[42px] right-[-240px] h-[1px] w-[980px] rotate-[-14deg] opacity-24"
        style={{ background: `linear-gradient(90deg, transparent, ${storyAccent}, transparent)` }}
      />
    </div>
  );
}

function StoryOfficialBrandLogo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="Altruist Sehat official logo"
      className="h-[150px] w-[600px] shrink-0 object-contain object-left"
      data-brand-share="dominant"
      data-header-align="week-block"
      data-testid="official-brand-logo"
      src={officialStoryLogoSrc}
    />
  );
}

function StorySportIcon({
  className,
  sportType,
}: {
  className?: string;
  sportType: string;
}) {
  const { Icon, id } = getStorySportIcon(sportType);

  return (
    <Icon
      aria-hidden="true"
      className={cn("shrink-0 text-[#FFC72C]", className)}
      data-premium-icon="svg"
      data-sport-icon={id}
      data-testid="story-sport-icon"
      strokeWidth={2.55}
    />
  );
}

function StoryHeader({ spec }: { spec: LeaderboardSpec }) {
  return (
    <header
      className="grid min-h-[150px] shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-7"
      data-layout-balance="brand-dominant"
      data-testid="story-header"
    >
      <div className="flex min-w-0 items-center">
        <StoryOfficialBrandLogo />
      </div>
      <div className="flex h-[150px] shrink-0 flex-col items-end justify-between text-right" data-align-target="brand-logo" data-testid="story-week-block">
        <div className="whitespace-nowrap font-black italic leading-none text-[60px] text-[#FFC72C]" style={{ lineHeight: 1 }}>
          {formatWeekLabel(spec.weekNumber)}
        </div>
        <div className="flex items-center justify-end gap-3">
          <StorySportIcon className="size-[31px]" sportType={spec.sportType} />
          <span className="font-black italic uppercase leading-none text-[29px] text-white" style={{ lineHeight: 1 }}>
            {spec.sportType.toUpperCase()}
          </span>
        </div>
        <div
          className={cn("max-w-[330px] whitespace-nowrap font-medium uppercase leading-none text-[#A1A1AA]", storyDateClass(spec.dateRange))}
          style={{ lineHeight: 1 }}
        >
          {spec.dateRange}
        </div>
      </div>
    </header>
  );
}

function StoryTrendGraph({ values }: { values: number[] }) {
  const points = values.length ? values : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 260;
  const height = 112;
  const coordinates = points.map((value, index) => {
    const x = points.length === 1 ? width - 20 : 20 + (index / (points.length - 1)) * (width - 40);
    const y = height - ((value - min) / range) * (height - 34) - 16;
    return { x, y, value };
  });
  const path = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <svg aria-label="Performance trend graph" className="overflow-visible" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <polyline fill="none" points={path} stroke={storyAccent} strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" />
      {coordinates.map(({ x, y, value }, index) => (
        <g key={`${value}-${index}`}>
          <line stroke={storyAccent} strokeDasharray="3 8" strokeOpacity="0.38" strokeWidth="2" x1={x} x2={x} y1={y + 12} y2={height} />
          <circle cx={x} cy={y} fill="#111111" r="9" stroke={storyAccent} strokeWidth="5" />
        </g>
      ))}
    </svg>
  );
}

function StorySummary({ spec, total }: { spec: LeaderboardSpec; total: number }) {
  const currentTotal = deriveCurrentTrendTotal(spec.trendValues, total);
  const totalParts = splitMetricValue(currentTotal, spec.metric, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const previousTotal = derivePreviousWeekTotal(spec.trendValues) ?? spec.previousWeekTotal ?? 0;
  const comparison = previousTotal > 0 ? calculateWeeklyComparison(currentTotal, previousTotal) : "0%";

  return (
    <section
      className="mt-6 grid min-h-[206px] shrink-0 grid-cols-[350px_246px_260px] items-center gap-6 overflow-hidden rounded-[8px] border border-white/10 bg-[#111111]/76 px-8 py-5"
      data-testid="stats-section"
    >
      <div>
        <div className="font-medium uppercase leading-none text-[25px] tracking-[0.02em] text-[#A1A1AA]">Weekly Total</div>
        <div className="mt-5 flex items-end gap-4">
          <span className={cn("whitespace-nowrap font-black leading-[0.82] text-white", storySummaryNumberClass(totalParts.number))}>{totalParts.number}</span>
          {totalParts.unit ? <span className="pb-2 font-black leading-none text-[30px] text-[#FFC72C]">{totalParts.unit}</span> : null}
        </div>
      </div>
      <div className="border-l border-white/10 pl-8">
        <div className="font-medium uppercase leading-none text-[24px] text-[#A1A1AA]">{previousWeekLabel(spec.weekNumber)}</div>
        <div
          className={cn(
            "mt-5 font-black leading-none",
            storyComparisonClass(comparison),
            comparisonClassName(comparison, "text-[#FFC72C]", "text-[#FF4D4D]", "text-[#A1A1AA]"),
          )}
          data-trend-importance="strong"
          data-testid="weekly-comparison"
        >
          <span>{comparison}</span>
        </div>
        <div className="mt-4 font-bold leading-none text-[22px] text-[#A1A1AA]">
          ({formatMetricValue(previousTotal, spec.metric, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
        </div>
      </div>
      <div className="justify-self-end">
        <StoryTrendGraph values={(spec.trendValues.length ? spec.trendValues : [total]).slice(-7)} />
      </div>
    </section>
  );
}

function StoryLeaderboardTitle({ spec }: { spec: LeaderboardSpec }) {
  return (
    <section
      className="mt-6 flex min-w-0 shrink-0 items-center gap-4 overflow-visible whitespace-nowrap px-3"
      data-overflow-policy="visible"
      data-safe-area="true"
      data-safe-area-left="58"
      data-title-padding-x="12"
      data-testid="story-leaderboard-title"
    >
      <StorySportIcon className="size-[37px] shrink-0" sportType={spec.sportType} />
      <div
        className="shrink-0 overflow-visible px-[8px] pr-[12px] font-black italic uppercase leading-[1.08] text-[37px] text-white"
        data-glyph-safe="true"
        data-testid="story-title-main"
        title={spec.leaderboardTitle}
      >
        {spec.leaderboardTitle}
      </div>
      <div className="h-[36px] w-px shrink-0 bg-[#FFC72C]" />
      <div
        className="shrink-0 overflow-visible px-[8px] font-black italic uppercase leading-[1.08] text-[29px] tracking-[0.06em] text-[#FFC72C]"
        data-glyph-safe="true"
        title={spec.leaderboardMetric}
      >
        {spec.leaderboardMetric}
      </div>
    </section>
  );
}

function StoryAthleteImage({
  athlete,
  spec,
}: {
  athlete: RankedAthlete;
  spec: LeaderboardSpec;
}) {
  const imageSrc = resolveAthleteImage(resolveAthletePodiumImage(athlete, spec), athlete.avatarDataUrl, athlete.profilePhotoUrl);
  const adjustment = photoAdjustmentForAthlete(spec, athlete);

  if (imageSrc) {
    return (
      <div
        className="absolute inset-0 z-[1] overflow-hidden"
        data-athlete-id={athlete.id}
        data-export-photo-adjust-target="true"
        data-fit-strategy="full-bleed-smart-crop"
        data-image-area="expanded-hero"
        data-layer="athlete-image"
        data-layout-mode={exportLayoutModeForSpec(spec)}
        data-rank={athlete.rank}
        data-testid={`podium-image-layer-${athlete.rank}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={`${athlete.name} athlete photo`}
          className="h-full w-full object-cover object-center"
          data-crop="full-bleed-smart-crop"
          data-image-density="adaptive-zoom"
          data-image-layer="athlete"
          data-image-position="center"
          data-photo-adjustment={photoAdjustmentData(adjustment)}
          data-testid={`athlete-cutout-rank-${athlete.rank}`}
          src={imageSrc}
          style={podiumPhotoAdjustmentStyle(adjustment)}
        />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-[1]"
      data-image-area="expanded-hero"
      data-layer="athlete-image"
      data-testid={`podium-image-layer-${athlete.rank}`}
    >
      <div
        className="relative h-full w-full"
        data-crop="editorial-fallback"
        data-image-layer="athlete"
        data-image-position="center"
        data-testid={`athlete-cutout-rank-${athlete.rank}`}
      >
        <div className="absolute bottom-0 left-1/2 h-[68%] w-[76%] -translate-x-1/2 rounded-t-[46%] bg-gradient-to-b from-[#565656] to-[#1b1b1b] opacity-95" />
        <div className="absolute left-1/2 top-[24%] size-[102px] -translate-x-1/2 rounded-[46%] bg-gradient-to-br from-[#666666] to-[#242424]" />
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 font-black italic text-[33px] text-white">{initialsForName(athlete.name)}</div>
      </div>
    </div>
  );
}

function StoryPodiumAthlete({ athlete, spec }: { athlete: RankedAthlete; spec: LeaderboardSpec }) {
  const isChampion = athlete.rank === 1;
  const value = splitMetricValue(athlete.value, spec.metric);
  const displayName = storyDisplayName(athlete.name, "podium");
  const nameLines = storyPodiumNameLines(displayName);
  const medalTone = storyPodiumMedalTone(athlete.rank);

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col justify-end overflow-hidden rounded-[8px] border bg-[#111111]/50 px-6 pb-7 pt-5",
        isChampion ? "min-h-[512px] border-[#FFC72C] bg-[#111111]/72" : "mt-6 min-h-[478px] border-white/12",
      )}
      data-hero-scale={isChampion ? "champion" : "supporting"}
      data-athlete-id={athlete.id}
      data-export-photo-adjust-target="true"
      data-image-share="hero"
      data-layered-card="true"
      data-layout-mode={exportLayoutModeForSpec(spec)}
      data-name-space="final-expanded"
      data-podium-scale="final-expanded"
      data-rank={athlete.rank}
      data-testid={`podium-athlete-rank-${athlete.rank}`}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        data-layer="medal-backplate"
        data-medal-tone={medalTone}
        data-testid={`podium-medal-backplate-${athlete.rank}`}
        style={storyPodiumMedalBackplateStyle(medalTone)}
      />
      <StoryAthleteImage athlete={athlete} spec={spec} />
      <div
        className={cn(
          "absolute left-6 top-5 z-30 font-black italic leading-none drop-shadow-[0_3px_14px_rgba(0,0,0,0.98)]",
          isChampion ? "text-[54px] text-[#FFC72C]" : athlete.rank === 2 ? "text-[46px] text-[#f2f2f2]" : "text-[46px] text-[#d8893a]",
        )}
        data-rank-placement="top-left"
        data-testid={`podium-rank-number-${athlete.rank}`}
      >
        {athlete.rank}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 z-10 h-[78%] bg-[linear-gradient(to_bottom,rgba(0,0,0,0)_0%,rgba(0,0,0,0.22)_32%,rgba(0,0,0,0.94)_100%)]"
        data-contrast-guard="true"
        data-gradient-share="expanded"
        data-layer="readability-gradient"
        data-testid={`podium-gradient-overlay-${athlete.rank}`}
      />
      <div
        className="relative z-20 mt-auto flex min-w-0 flex-col justify-end"
        data-layer="text"
        data-testid={`podium-text-layer-${athlete.rank}`}
      >
        <div className="flex min-w-0 items-end justify-center gap-3">
          <span
            className={cn("font-black leading-[0.85] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]", storyPodiumValueClass(value.number, isChampion))}
            data-testid={isChampion ? "champion-distance-number" : undefined}
          >
            {value.number}
          </span>
          {value.unit ? (
            <span
              className={cn("pb-1 font-black leading-none text-[#FFC72C] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]", isChampion ? "text-[24px]" : "text-[20px]")}
              data-testid={isChampion ? "champion-distance-unit" : undefined}
            >
              {value.unit}
            </span>
          ) : null}
        </div>
        <div className="mt-4 flex min-h-[104px] min-w-0 items-center justify-center px-1 text-center">
        <div
          className={cn(
            "min-w-0 max-w-full whitespace-normal text-center font-medium uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]",
            storyNameClass(displayName, "podium"),
            isChampion ? "text-[#FFC72C]" : "text-white",
          )}
          data-display-name={displayName}
          data-full-name={athlete.name}
          data-max-lines="3"
          data-name-color={isChampion ? "gold" : "white"}
          data-name-lines={nameLines.length}
          data-text-fit="wrap"
          title={athlete.name}
        >
          {nameLines.map((line, index) => (
            <span className="block" data-testid="podium-name-line" key={`${athlete.id}-name-${index}`}>
              {line}
              {index < nameLines.length - 1 ? " " : ""}
            </span>
          ))}
        </div>
        </div>
      </div>
    </article>
  );
}

function StoryPodium({ spec }: { spec: LeaderboardSpec }) {
  const ranked = buildLeaderboardRows(spec.athletes, 3);
  const ordered = [ranked[1], ranked[0], ranked[2]].filter(Boolean);

  return (
    <section className="mt-5 grid shrink-0 grid-cols-[1fr_1.08fr_1fr] items-end gap-4" data-density="expanded" data-testid="podium-hero-section">
      {ordered.map((athlete) => (
        <StoryPodiumAthlete athlete={athlete} key={athlete.id} spec={spec} />
      ))}
    </section>
  );
}

function StoryTableAvatar({ athlete, spec }: { athlete: RankedAthlete; spec: LeaderboardSpec }) {
  const imageSrc = resolveAthleteImage(athlete.profilePhotoUrl, athlete.avatarDataUrl, resolveAthletePodiumImage(athlete, spec));

  return (
    <div
      className="grid size-[36px] place-items-center overflow-hidden rounded-full bg-white/10 text-[11px] font-black text-white"
      data-avatar-size="large"
      data-testid="story-table-avatar"
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={imageSrc} />
      ) : (
        <span>{initialsForName(athlete.name)}</span>
      )}
    </div>
  );
}

function StoryTableMetricValue({ athlete, metric }: { athlete: RankedAthlete; metric: LeaderboardSpec["metric"] }) {
  if (metric !== "time_minutes") {
    return <>{formatMetricValue(athlete.value, metric)}</>;
  }

  const value = formatMetricDisplayParts(athlete.value, metric);

  return (
    <span className="inline-flex items-end justify-end gap-2">
      <span className="text-white">{value.primary}</span>
      {value.accent ? <span className="text-[#FFC72C]">{value.accent}</span> : null}
    </span>
  );
}

function StoryTable({ spec }: { spec: LeaderboardSpec }) {
  const rows = buildLeaderboardRows(spec.athletes, 10).slice(3);
  const columns = "112px 1fr 200px";

  return (
    <section
      className="mt-6 shrink-0 overflow-hidden rounded-[8px] border border-white/10 bg-[#111111]/72 px-8 py-6"
      data-importance="primary"
      data-footer-gap-target="compact"
      data-row-size="expanded"
      data-testid="supporting-ranking-table"
    >
      <div
        className="grid border-b border-white/10 pb-4 font-medium uppercase leading-none text-[19px] tracking-[0.04em] text-[#A1A1AA]"
        data-testid="story-table-header"
        style={{ gridTemplateColumns: columns }}
      >
        <span>RANK</span>
        <span>MEMBER</span>
        <span className="pr-4 text-right" data-value-padding="right">
          VALUE
        </span>
      </div>
      {rows.map((athlete) => {
        const displayName = storyDisplayName(athlete.name, "table");

        return (
          <div
            className="grid h-[80px] items-center border-b border-white/[0.08] last:border-b-0"
            key={athlete.id}
            style={{ gridTemplateColumns: columns }}
          >
            <span className="font-black leading-none text-[29px] text-white" data-testid={`table-rank-${athlete.rank}`}>
              {athlete.rank}
            </span>
            <div className="flex min-w-0 items-center gap-6">
            <StoryTableAvatar athlete={athlete} spec={spec} />
              <span
                className={cn("min-w-0 overflow-hidden whitespace-nowrap font-medium uppercase leading-none tracking-[0.04em] text-white", storyNameClass(displayName, "table"))}
                data-display-name={displayName}
                data-text-fit="word-fallback"
                title={athlete.name}
              >
                {displayName}
              </span>
            </div>
            <span
              className="pr-4 text-right font-black leading-none text-[30px] text-[#FFC72C]"
              data-testid="story-value-cell"
              data-value-padding="right"
            >
              <StoryTableMetricValue athlete={athlete} metric={spec.metric} />
            </span>
          </div>
        );
      })}
    </section>
  );
}

function compactRowNameClass(name: string, rowCount: number) {
  if (rowCount === 1) {
    return name.length > 28 ? "text-[39px]" : name.length > 18 ? "text-[45px]" : "text-[52px]";
  }

  return name.length > 30 ? "text-[23px]" : name.length > 20 ? "text-[27px]" : "text-[31px]";
}

function compactRowValueClass(number: string, rowCount: number) {
  if (rowCount === 1) {
    return number.length > 6 ? "text-[72px]" : "text-[86px]";
  }

  return number.length > 6 ? "text-[42px]" : "text-[50px]";
}

function compactRowAccentClass(rowCount: number) {
  return rowCount === 1 ? "text-[30px]" : "text-[20px]";
}

function StoryCompactRows({ spec }: { spec: LeaderboardSpec }) {
  const rows = buildLeaderboardRows(spec.athletes, 5);
  const rowCount = Math.max(1, rows.length);

  return (
    <section
      className="mt-5 grid h-[1180px] shrink-0 gap-4"
      data-layout="cinematic-rows"
      data-row-count={rows.length}
      data-row-height="equal"
      data-stage-anchor="top-10-footer"
      data-testid="story-compact-rows"
      style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
    >
      {rows.length ? (
        rows.map((athlete) => (
          <StoryCompactRow athlete={athlete} key={athlete.id} rowCount={rowCount} spec={spec} />
        ))
      ) : (
        <div className="rounded-[8px] border border-white/10 bg-[#111111]/72" data-testid="story-compact-empty-row" />
      )}
    </section>
  );
}

function StoryCompactRow({
  athlete,
  rowCount,
  spec,
}: {
  athlete: RankedAthlete;
  rowCount: number;
  spec: LeaderboardSpec;
}) {
  const imageSrc = resolveAthleteImage(resolveAthletePodiumImage(athlete, spec), athlete.profilePhotoUrl, athlete.avatarDataUrl);
  const isChampion = athlete.rank === 1;
  const value = formatMetricDisplayParts(athlete.value, spec.metric);
  const adjustment = photoAdjustmentForAthlete(spec, athlete);
  const rankColor = isChampion ? "text-[#FFC72C]" : athlete.rank === 2 ? "text-white/82" : athlete.rank === 3 ? "text-[#c47b35]" : "text-white/62";
  const nameLineClamp = {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical" as const,
    WebkitLineClamp: 2,
    overflow: "hidden",
  };
  const foregroundMaskStyle = {
    WebkitMaskImage: "linear-gradient(to right, #000 0%, #000 58%, rgba(0,0,0,0.76) 76%, transparent 100%)",
    maskImage: "linear-gradient(to right, #000 0%, #000 58%, rgba(0,0,0,0.76) 76%, transparent 100%)",
  };

  return (
    <article
      className={cn(
        "relative min-h-0 overflow-hidden rounded-[8px] border bg-[#111111]/72",
        isChampion ? "border-[#FFC72C]/80 shadow-[0_0_0_1px_rgba(255,199,44,0.24)]" : "border-white/12",
      )}
      data-athlete-id={athlete.id}
      data-export-photo-adjust-target="true"
      data-layout-mode={exportLayoutModeForSpec(spec)}
      data-rank={athlete.rank}
      data-row-height="equal"
      data-testid={`story-compact-row-rank-${athlete.rank}`}
    >
      <div className="absolute inset-0 z-0 overflow-hidden" data-image-area="cinematic-row" data-layer="athlete-image">
        <div className="absolute inset-0" data-layer="compact-medal-backplate" style={compactCutoutBackdropStyle(athlete.rank)} />
        {imageSrc ? (
          <div className="absolute inset-0" style={foregroundMaskStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt={`${athlete.name} athlete photo`}
              className="h-full w-full object-contain object-center opacity-95 drop-shadow-[0_20px_34px_rgba(0,0,0,0.48)]"
              data-fit-strategy="medal-backplate-foreground"
              data-image-layer="compact-photo-foreground"
              data-image-position="adjustable-foreground"
              data-photo-adjustment={photoAdjustmentData(adjustment)}
              data-testid={`story-compact-row-image-${athlete.rank}`}
              src={imageSrc}
              style={compactPhotoForegroundAdjustmentStyle(adjustment)}
            />
          </div>
        ) : (
          <div
            className="relative h-full w-full bg-[radial-gradient(circle_at_26%_42%,rgba(255,255,255,0.18),transparent_24%),linear-gradient(135deg,#3f3f3f_0%,#151515_54%,#050505_100%)]"
            data-crop="cinematic-row-fallback"
            data-testid={`story-compact-row-image-${athlete.rank}`}
          >
            <div className="absolute left-[16%] top-1/2 -translate-y-1/2 font-black italic leading-none text-[86px] text-white/18">
              {initialsForName(athlete.name)}
            </div>
          </div>
        )}
      </div>
      <div
        className="absolute inset-0 z-10"
        data-layer="cinematic-row-fade"
        style={{
          background:
            "linear-gradient(to left, rgba(5,5,5,0.88) 0%, rgba(5,5,5,0.62) 36%, rgba(5,5,5,0.26) 66%, rgba(5,5,5,0.08) 100%)",
        }}
      />
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 38%, rgba(0,0,0,0.42) 100%)",
        }}
      />
      <div className="relative z-20 grid h-full min-h-0 grid-cols-[minmax(0,0.72fr)_minmax(390px,0.88fr)] items-center">
        <div className="flex h-full items-start p-7">
          <span
            className={cn(
              "font-black italic leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]",
              rankColor,
              rowCount === 1 ? "text-[92px]" : "text-[56px]",
            )}
            data-testid={`story-compact-row-rank-${athlete.rank}-number`}
          >
            {athlete.rank}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-end justify-center px-8 text-right">
          <div
            className={cn(
              "max-w-full font-medium uppercase leading-[1.04] tracking-[0.06em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]",
              compactRowNameClass(athlete.name, rowCount),
              isChampion && "text-[#FFC72C]",
            )}
            data-testid={`story-compact-row-name-${athlete.rank}`}
            style={nameLineClamp}
            title={athlete.name}
          >
            {athlete.name}
          </div>
          <div className={cn("flex min-w-0 items-end justify-end gap-3", rowCount === 1 ? "mt-4" : "mt-3")}>
            <span
              className={cn(
                "font-black leading-[0.84] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]",
                compactRowValueClass(value.primary, rowCount),
              )}
              data-testid={`story-compact-row-value-${athlete.rank}`}
            >
              {value.primary}
            </span>
            {value.accent ? (
              <span className={cn("pb-1 font-black leading-none text-[#FFC72C] drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]", compactRowAccentClass(rowCount))}>
                {value.accent}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function StoryFooter({ quote }: { quote: string }) {
  const words = quote
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const chasing = words[0] ?? "CHASING";
  const better = words[1] ?? "BETTER";
  const rest = words.slice(2).join(" ") || "EVERY DAY";

  return (
    <footer
      className="mt-auto shrink-0 pb-[48px] pt-4"
      data-footer-anchor="top-10"
      data-footer-safe-offset="48"
      data-testid="poster-footer"
    >
      <div className="text-left">
        <div className="font-black italic leading-none tracking-[0.42em] text-[29px] text-white">{chasing}</div>
        <div className="mt-2 font-black italic leading-[0.82] tracking-[0.16em] text-[60px] text-[#FFC72C]" data-emphasis="largest" data-testid="brand-word-better">
          {better}
        </div>
        <div className="mt-3 font-black italic leading-none tracking-[0.44em] text-[29px] text-white">{rest}</div>
      </div>
    </footer>
  );
}

function StorySourceAttribution() {
  return (
    <div
      className="absolute bottom-[154px] right-[58px] z-30 flex h-[34px] items-center gap-2.5 rounded-full border border-white/14 bg-black/78 px-3.5 text-[14px] font-bold leading-none text-white shadow-[0_8px_22px_rgba(0,0,0,0.38)] backdrop-blur-[2px]"
      data-source-visibility="enhanced"
      data-source-position="footer-bottom-right"
      data-testid="story-source-attribution"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Strava app logo"
        className="size-[16px] shrink-0 object-contain opacity-80"
        data-testid="story-source-strava-logo"
        src={stravaSourceLogoSrc}
      />
      <span className="whitespace-nowrap text-[#F5F5F5]">Data from Strava</span>
    </div>
  );
}

function StatsSection({
  compact,
  spec,
  theme,
  total,
}: {
  compact: boolean;
  spec: LeaderboardSpec;
  theme: PosterTheme;
  total: number;
}) {
  const totalParts = splitMetricValue(total, spec.metric, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const comparison = (spec.previousWeekTotal ?? 0) > 0 ? calculateWeeklyComparison(total, spec.previousWeekTotal) : "0%";

  return (
    <section
      className={cn(
        "grid items-center overflow-hidden rounded-[8px] border backdrop-blur-sm",
        compact ? "mt-6 min-h-[138px] grid-cols-[1fr_220px] gap-5 px-6 py-4" : "mt-8 min-h-[188px] grid-cols-[1fr_230px_340px] gap-7 px-8 py-5",
        theme.panelStrong,
      )}
      data-layout-share="compact"
      data-testid="stats-section"
    >
      <div>
        <div className={cn("font-black uppercase", compact ? "text-[18px]" : "text-[26px]", theme.muted)}>Weekly Total</div>
        <div className="mt-2 flex items-end gap-3">
          <span className={cn("font-black leading-none", compact ? "text-[56px]" : "text-[86px]", theme.text)}>
            {totalParts.number}
          </span>
          <span className={cn("pb-2 font-black", compact ? "text-[20px]" : "text-[29px]", theme.accent)}> {totalParts.unit}</span>
        </div>
      </div>

      <div className={cn("border-l pl-7", compact ? "hidden" : "block", theme.line)}>
        <div className={cn("font-black uppercase", compact ? "text-[17px]" : "text-[22px]", theme.muted)}>vs last week</div>
        <div
          className={cn(
            "mt-3 font-black",
            compact ? "text-[32px]" : "text-[44px]",
            comparisonClassName(comparison, theme.accent, theme.negative, theme.muted),
          )}
        >
          <span>{comparison}</span>
        </div>
        <div className={cn("mt-2 font-bold", compact ? "text-[16px]" : "text-[22px]", theme.muted)}>
          ({formatMetricValue(spec.previousWeekTotal ?? 0, spec.metric, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
        </div>
      </div>

      <div className="justify-self-end">
        <TrendGraph compact={compact} values={[...spec.trendValues, total].slice(-7)} />
      </div>
    </section>
  );
}

function PodiumAthlete({
  athlete,
  compact,
  metric,
  spec,
  theme,
}: {
  athlete: RankedAthlete;
  compact: boolean;
  metric: LeaderboardSpec["metric"];
  spec: LeaderboardSpec;
  theme: PosterTheme;
}) {
  const isChampion = athlete.rank === 1;
  const value = splitMetricValue(athlete.value, metric);
  const sideTone = athlete.rank === 2 ? "text-white/72" : "text-[#c47b35]";
  const podiumLevel = isChampion ? "highest" : "lower";

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col justify-end overflow-visible px-3 text-center",
        isChampion ? "z-20" : "z-10",
        isChampion ? "translate-y-0" : compact ? "translate-y-[28px]" : "translate-y-[42px]",
        compact ? "min-h-[318px]" : "min-h-[468px]",
      )}
      data-hero-scale={isChampion ? "champion" : "supporting"}
      data-podium-level={podiumLevel}
      data-testid={`podium-athlete-rank-${athlete.rank}`}
    >
      {!isChampion ? (
        <div className="absolute bottom-0 top-12 w-px bg-[#FFC400]/40" />
      ) : null}

      <div
        className={cn(
          "relative z-20 mb-[-12px] font-black italic leading-none",
          isChampion ? (compact ? "text-[54px]" : "text-[64px]") : compact ? "text-[44px]" : "text-[50px]",
          isChampion ? theme.accent : sideTone,
        )}
      >
        {athlete.rank}
      </div>

      <AthleteCutout athlete={athlete} compact={compact} rank={athlete.rank} spec={spec} />

      <div className="relative z-20 mt-[-12px]">
        <div className="flex items-end justify-center gap-3">
          <span
            className={cn("font-black leading-[0.82]", isChampion ? (compact ? "text-[64px]" : "text-[70px]") : compact ? "text-[42px]" : "text-[48px]", theme.text)}
            data-testid={isChampion ? "champion-distance-number" : undefined}
          >
            {value.number}
          </span>
          <span
            className={cn("pb-1 font-black", isChampion ? (compact ? "text-[26px]" : "text-[34px]") : compact ? "text-[20px]" : "text-[25px]", theme.accent)}
            data-testid={isChampion ? "champion-distance-unit" : undefined}
          >
            {value.unit}
          </span>
        </div>
        <div
          className={cn(
            "mt-3 truncate font-black uppercase",
            isChampion ? (compact ? "text-[25px]" : "text-[29px]") : compact ? "text-[18px]" : "text-[21px]",
            isChampion ? theme.accent : theme.muted,
          )}
        >
          {athlete.name}
        </div>
      </div>
    </article>
  );
}

function PodiumHero({ compact, spec, theme }: { compact: boolean; spec: LeaderboardSpec; theme: PosterTheme }) {
  const ranked = buildLeaderboardRows(spec.athletes, 3);
  const ordered = [ranked[1], ranked[0], ranked[2]].filter(Boolean);

  return (
    <section
      className={cn(
        "relative grid grid-cols-[0.92fr_1.18fr_0.92fr] items-end",
        compact ? "mt-5 min-h-[336px]" : "mt-6 min-h-[500px]",
      )}
      data-importance="hero"
      data-layout-share="balanced"
      data-testid="podium-hero-section"
    >
      <div className="absolute inset-x-0 bottom-[16px] h-px bg-gradient-to-r from-transparent via-[#FFC400]/35 to-transparent" />
      {ordered.map((athlete) => (
        <PodiumAthlete athlete={athlete} compact={compact} key={athlete.id} metric={spec.metric} spec={spec} theme={theme} />
      ))}
    </section>
  );
}

function TableAvatar({ athlete, compact, spec, theme }: { athlete: RankedAthlete; compact: boolean; spec: LeaderboardSpec; theme: PosterTheme }) {
  const imageSrc = resolveAthleteImage(athlete.profilePhotoUrl, athlete.avatarDataUrl, resolveAthletePodiumImage(athlete, spec));

  return (
    <div
      className={cn(
        "grid place-items-center overflow-hidden rounded-full border font-black",
        compact ? "size-[30px] text-[11px]" : "size-[34px] text-[12px]",
        theme.panel,
      )}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={imageSrc} />
      ) : (
        <span>{initialsForName(athlete.name)}</span>
      )}
    </div>
  );
}

function SupportingRankingTable({
  compact,
  spec,
  theme,
}: {
  compact: boolean;
  spec: LeaderboardSpec;
  theme: PosterTheme;
}) {
  const rows = buildLeaderboardRows(spec.athletes, 10).slice(3);
  const columns = compact ? "58px 44px 1fr 108px" : "72px 52px 1fr 140px";

  return (
    <section
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[8px] border backdrop-blur-sm",
        compact ? "mt-6 px-5 py-4" : "mt-8 px-8 py-6",
        theme.panel,
      )}
      data-importance="primary"
      data-layout-share="expanded"
      data-testid="supporting-ranking-table"
    >
      <div className={cn("mb-4 border-b pb-4", theme.line)} data-testid="table-title-block">
        <div className={cn("truncate font-black italic uppercase leading-none", compact ? "text-[28px]" : "text-[40px]", theme.text)}>
          {spec.leaderboardTitle}
        </div>
        <div className={cn("mt-2 font-black uppercase leading-none", compact ? "text-[12px]" : "text-[15px]", theme.accent)}>
          {spec.leaderboardMetric}
        </div>
      </div>
      <div
        className={cn("grid border-b pb-3 font-bold uppercase leading-none", compact ? "text-[10px]" : "text-[12px]", theme.muted, theme.line)}
        style={{ gridTemplateColumns: columns }}
      >
        <span>Rank</span>
        <span />
        <span>Member</span>
        <span className="text-right">Value</span>
      </div>
      {rows.map((athlete) => (
        <div
          className={cn("grid items-center border-b last:border-b-0", compact ? "h-[44px]" : "h-[62px]", theme.line)}
          key={athlete.id}
          style={{ gridTemplateColumns: columns }}
        >
          <span
            className={cn("font-black leading-none", compact ? "text-[17px]" : "text-[22px]", theme.text)}
            data-testid={`table-rank-${athlete.rank}`}
          >
            #{athlete.rank}
          </span>
          <TableAvatar athlete={athlete} compact={compact} spec={spec} theme={theme} />
          <span className={cn("min-w-0 truncate pr-4 font-medium uppercase leading-none", compact ? "text-[16px]" : "text-[20px]", theme.text)}>
            {athlete.name}
          </span>
          <span className={cn("text-right font-black leading-none", compact ? "text-[21px]" : "text-[26px]", theme.accent)}>
            {formatMetricValue(athlete.value, spec.metric)}
          </span>
        </div>
      ))}
    </section>
  );
}

function BrandStatement({ compact, quote, theme }: { compact: boolean; quote: string; theme: PosterTheme }) {
  const words = quote
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const chasing = words[0] ?? "CHASING";
  const better = words[1] ?? "BETTER";
  const rest = words.slice(2).join(" ") || "EVERY DAY";

  return (
    <footer
      className={cn("relative flex shrink-0 items-end justify-start", compact ? "mt-9" : "mt-12")}
      data-table-gap="large"
      data-testid="poster-footer"
    >
      <div className="text-left">
        <div className={cn("font-black italic leading-none tracking-[0.34em]", compact ? "text-[26px]" : "text-[28px]", theme.text)}>
          {chasing}
        </div>
        <div
          className={cn("font-black italic leading-[0.82] tracking-[0.12em]", compact ? "text-[46px]" : "text-[50px]", theme.accent)}
          data-emphasis="largest"
          data-testid="brand-word-better"
        >
          {better}
        </div>
        <div className={cn("font-black italic leading-none tracking-[0.36em]", compact ? "text-[26px]" : "text-[28px]", theme.text)}>
          {rest}
        </div>
      </div>
    </footer>
  );
}

function StoryLeaderboardCanvas({ spec }: { spec: LeaderboardSpec }) {
  const dimensions = OUTPUT_DIMENSIONS.story;
  const total = resolveMetricTotal(spec.athletes, spec.totalOverride);
  const storyLayoutMode = exportLayoutModeForSpec(spec);

  return (
    <div
      className="relative overflow-hidden bg-[#050505] font-sans text-white"
      data-export-frame
      data-export-ready="true"
      data-story-palette="fixed-dark"
      data-testid="export-frame"
      data-theme={spec.theme}
      data-visual-style="modern-dark-strava"
      style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
    >
      <StoryBackground />
      <div
        className="relative z-10 flex h-full flex-col px-[58px] py-[58px]"
        data-safe-area="story"
        data-safe-area-x="58"
        data-testid="story-safe-area"
      >
            <StoryHeader spec={spec} />
            <StorySummary spec={spec} total={total} />
            <StoryLeaderboardTitle spec={spec} />
            {storyLayoutMode !== "podiumTop10" ? (
              <StoryCompactRows spec={spec} />
            ) : (
              <>
                <StoryPodium spec={spec} />
                <StoryTable spec={spec} />
              </>
            )}
            <StoryFooter quote={spec.quote} />
          </div>
      <StorySourceAttribution />
    </div>
  );
}

function LegacyLeaderboardCanvas({ format, spec }: LeaderboardCanvasProps) {
  const dimensions = OUTPUT_DIMENSIONS[format];
  const theme = themes[spec.theme];
  const compact = format === "feed";
  const total = resolveMetricTotal(spec.athletes, spec.totalOverride);

  return (
    <div
      className={cn("relative overflow-hidden font-sans", theme.canvas)}
      data-export-frame
      data-export-ready="true"
      data-testid="export-frame"
      data-theme={spec.theme}
      data-visual-style="sports-poster"
      style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
    >
      <PosterBackground themeId={spec.theme} />
      <div className={cn("relative z-10 flex h-full flex-col", compact ? "p-[46px]" : "p-[58px]")}>
        <header className="flex items-start justify-between gap-8">
          <div className="flex min-w-0 items-center">
            <LogoMark compact={compact} spec={spec} theme={theme} />
            <div className="ml-6 min-w-0">
              <span className="sr-only">{spec.communityName}</span>
              <div
                className={cn("font-black italic uppercase leading-[0.94]", compact ? "text-[38px]" : "text-[54px]", theme.text)}
                data-text-fit="true"
                title={spec.communityName}
              >
                {spec.communityName.split(/\s+/).slice(0, -1).join(" ") || spec.communityName}
                {spec.communityName.split(/\s+/).length > 1 ? (
                  <span className={cn("ml-3", theme.accent)}>{spec.communityName.split(/\s+/).slice(-1)}</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={cn("whitespace-nowrap font-black italic leading-none", compact ? "text-[46px]" : "text-[62px]", theme.accent)}>
              {formatWeekLabel(spec.weekNumber)}
            </div>
            <div className={cn("mt-3 flex items-center justify-end gap-2 font-black italic uppercase", compact ? "text-[25px]" : "text-[34px]", theme.text)}>
              <StorySportIcon className={cn(compact ? "size-[22px]" : "size-[30px]", theme.accent)} sportType={spec.sportType} />
              <span>{spec.sportType.toUpperCase()}</span>
            </div>
            <div className={cn("mt-2 font-medium", compact ? "text-[18px]" : "text-[24px]", theme.muted)}>{spec.dateRange}</div>
          </div>
        </header>

        <StatsSection compact={compact} spec={spec} theme={theme} total={total} />
        <PodiumHero compact={compact} spec={spec} theme={theme} />
        <SupportingRankingTable compact={compact} spec={spec} theme={theme} />
        <BrandStatement compact={compact} quote={spec.quote} theme={theme} />
      </div>
    </div>
  );
}

export function LeaderboardCanvas({ format, spec }: LeaderboardCanvasProps) {
  if (format === "story") {
    return <StoryLeaderboardCanvas spec={spec} />;
  }

  return <LegacyLeaderboardCanvas format={format} spec={spec} />;
}
