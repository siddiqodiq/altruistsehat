import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Medal, Trophy } from "lucide-react";
import { initialsForName } from "@/lib/leaderboard/images";
import { formatMetricValue } from "@/lib/leaderboard/metrics";
import { buildPublicAthleteProfilePayload, type PublicAthleteProfile } from "@/lib/profile/public-profile";
import { errorMessage } from "@/lib/supabase/errors";
import {
  athletePublicSelectColumns,
  createSupabaseServiceClient,
  isMissingAthletePodiumPhotoAdjustmentsColumn,
  isMissingAthleteSportPodiumPhotoUrlsColumn,
  mapPublicAthleteRow,
  type AthleteRow,
} from "@/lib/supabase/server";
import {
  LeaderboardWeekSnapshotSchema,
  type LeaderboardWeekSnapshot,
} from "@/lib/leaderboard/week-snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ username: string }>;
}

interface LeaderboardWeekSnapshotRow {
  athlete_count: number;
  client_id: string;
  created_at?: string | null;
  exported_at: string;
  id?: string | null;
  season_year: string;
  spec: unknown;
  template_id: string;
  total: number | string;
  updated_at?: string | null;
  week_number: string;
}

function mapSnapshotRow(row: LeaderboardWeekSnapshotRow): LeaderboardWeekSnapshot | undefined {
  const parsed = LeaderboardWeekSnapshotSchema.safeParse({
    athleteCount: row.athlete_count,
    clientId: row.client_id,
    createdAt: row.created_at ?? undefined,
    exportedAt: row.exported_at,
    id: row.id ?? undefined,
    seasonYear: row.season_year,
    spec: row.spec,
    templateId: row.template_id,
    total: Number(row.total),
    updatedAt: row.updated_at ?? undefined,
    weekNumber: row.week_number,
  });

  return parsed.success ? parsed.data : undefined;
}

async function publicAthleteByUsername(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  username: string,
) {
  const options = { includePodiumPhotoAdjustments: true, includeSportPodiumPhotoUrls: true };
  let { data, error } = await supabase
    .from("athletes")
    .select(athletePublicSelectColumns(options))
    .eq("username", username)
    .maybeSingle();

  if (error && isMissingAthletePodiumPhotoAdjustmentsColumn(error)) {
    options.includePodiumPhotoAdjustments = false;
    ({ data, error } = await supabase
      .from("athletes")
      .select(athletePublicSelectColumns(options))
      .eq("username", username)
      .maybeSingle());
  }
  if (error && isMissingAthleteSportPodiumPhotoUrlsColumn(error)) {
    options.includeSportPodiumPhotoUrls = false;
    ({ data, error } = await supabase
      .from("athletes")
      .select(athletePublicSelectColumns(options))
      .eq("username", username)
      .maybeSingle());
  }

  if (error) {
    throw error;
  }

  return data ? mapPublicAthleteRow(data as unknown as AthleteRow) : null;
}

async function loadLeaderboardSnapshots(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
) {
  const { data, error } = await supabase
    .from("leaderboard_week_snapshots")
    .select("id,client_id,season_year,week_number,template_id,spec,total,athlete_count,exported_at,created_at,updated_at")
    .order("exported_at", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as unknown as LeaderboardWeekSnapshotRow[])
    .map(mapSnapshotRow)
    .filter((snapshot): snapshot is LeaderboardWeekSnapshot => Boolean(snapshot));
}

export async function loadPublicAthleteProfileByUsername(username: string): Promise<PublicAthleteProfile | null> {
  const safeUsername = decodeURIComponent(username).trim();
  if (!safeUsername) {
    return null;
  }

  const supabase = createSupabaseServiceClient();
  const athlete = await publicAthleteByUsername(supabase, safeUsername);
  if (!athlete) {
    return null;
  }

  const snapshots = await loadLeaderboardSnapshots(supabase);
  return buildPublicAthleteProfilePayload({ athlete, snapshots });
}

export async function generateMetadata({ params }: PageProps) {
  const { username } = await params;
  const profile = await loadPublicAthleteProfileByUsername(username).catch(() => null);

  return {
    title: profile ? `${profile.athlete.name} | Profil Atlet` : "Profil Atlet",
  };
}

export default async function PublicAthleteProfilePage({ params }: PageProps) {
  const { username } = await params;
  const profile = await loadPublicAthleteProfileByUsername(username).catch((error) => {
    console.error("PUBLIC_ATHLETE_PROFILE_LOAD_FAILED", errorMessage(error, "Failed to load public athlete profile."));
    return null;
  });

  if (!profile) {
    notFound();
  }

  const { athlete, mileageBySport, sports } = profile;
  const totalDistance = mileageBySport
    .filter((item) => item.metric === "distance_km" || item.metric === "cycling_distance_km")
    .reduce((sum, item) => sum + item.total, 0);

  return (
    <main className="topbar-clearance min-h-screen bg-primary-beige px-4 pb-20 text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Link
          className="inline-flex w-fit items-center gap-2 text-sm font-black text-primary-brown underline-offset-4 transition hover:underline dark:text-secondary-sand"
          href="/leaderboard"
        >
          <ArrowLeft className="size-4" />
          Kembali ke leaderboard
        </Link>

        <section className="grid gap-6 rounded-xl border border-secondary-sand/70 bg-white p-5 shadow-[0_18px_44px_rgb(90,46,23,0.10)] dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <div className="grid size-24 place-items-center overflow-hidden rounded-full bg-primary-green/15 text-2xl font-black text-primary-green ring-1 ring-primary-green/20 md:size-28">
            {athlete.profilePhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${athlete.name} profile`} className="h-full w-full object-cover" src={athlete.profilePhotoUrl} />
            ) : (
              initialsForName(athlete.name)
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary-brown dark:text-secondary-sand">Profil Atlet</p>
            <h1 className="mt-2 font-poppins text-3xl font-black tracking-normal text-primary-charcoal dark:text-white md:text-4xl">
              {athlete.name}
            </h1>
            <p className="mt-2 text-sm font-semibold text-primary-charcoal/60 dark:text-gray-400">
              @{athlete.username ?? athlete.normalizedName}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.85fr)]">
          <div className="grid gap-6">
            <div className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-primary-brown dark:text-secondary-sand" />
                <h2 className="font-poppins text-xl font-black">Data Mileage</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl bg-secondary-sand/20 p-4 dark:bg-zinc-900">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-primary-charcoal/50 dark:text-gray-400">Total Distance</p>
                  <p className="mt-2 text-2xl font-black text-primary-charcoal dark:text-white">
                    {formatMetricValue(totalDistance, "distance_km")}
                  </p>
                </div>
                {mileageBySport.map((item) => (
                  <div className="rounded-xl border border-secondary-sand/70 p-4 dark:border-zinc-800" key={`${item.templateId}-${item.metric}`}>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-primary-brown dark:text-secondary-sand">{item.sport}</p>
                    <p className="mt-2 text-xl font-black text-primary-charcoal dark:text-white">
                      {formatMetricValue(item.total, item.metric)}
                    </p>
                    <p className="mt-1 text-xs font-bold text-primary-charcoal/55 dark:text-gray-400">{item.snapshotCount} minggu tersimpan</p>
                  </div>
                ))}
                {!mileageBySport.length ? (
                  <div className="rounded-xl border border-dashed border-secondary-sand p-4 text-sm font-semibold text-primary-charcoal/55 dark:border-zinc-700 dark:text-gray-400">
                    Belum ada data leaderboard untuk atlet ini.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <Medal className="size-5 text-primary-brown dark:text-secondary-sand" />
                <h2 className="font-poppins text-xl font-black">Olahraga yang Diikuti</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {sports.map((sport) => (
                  <span className="rounded-full bg-primary-green/12 px-3 py-1.5 text-sm font-black text-primary-green" key={sport}>
                    {sport}
                  </span>
                ))}
                {sports.length ? null : (
                  <span className="text-sm font-semibold text-primary-charcoal/55 dark:text-gray-400">Belum ada olahraga yang tercatat.</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid content-start gap-6">
            <div className="grid gap-4 rounded-xl border border-secondary-sand/70 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="font-poppins text-xl font-black">Foto Podium</h2>
              <div className="grid h-[360px] place-items-center overflow-hidden rounded-xl border border-secondary-sand/70 bg-secondary-sand/20 dark:border-zinc-800 dark:bg-zinc-900">
                {athlete.podiumPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`${athlete.name} podium`} className="h-full w-full object-cover object-center" src={athlete.podiumPhotoUrl} />
                ) : (
                  <span className="text-sm font-black text-primary-charcoal/35 dark:text-gray-500">{initialsForName(athlete.name)}</span>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
