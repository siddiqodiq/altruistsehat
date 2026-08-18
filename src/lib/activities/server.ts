import type { ActivityImage, ActivityDetails, ActivityParticipant, ActivityVisibility } from "./types";
import type { ActivityGuestRegistrationPayload, ActivityPatchPayload, ActivityPayload } from "./schema";
import { normalizeRegistrationPhone } from "./schema";
import { activityRegistrationState } from "./registration";
import { coverImageForActivity, formatActivitySchedule } from "./schedule";
import type { createSupabaseServiceClient } from "@/lib/supabase/server";

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

export interface ActivityRow {
  id: string;
  name: string;
  activity_type: string;
  sport_type: string;
  description: string;
  location: string;
  starts_at: string | null;
  schedule_mode: ActivityDetails["scheduleMode"] | null;
  schedule_label: string | null;
  recurrence_interval: number | null;
  recurrence_weekday: number | null;
  recurrence_month_week: number | null;
  recurrence_time: string | null;
  documentation_url: string | null;
  logo_has_white_outline?: boolean | null;
  logo_url?: string | null;
  registration_closed?: boolean | null;
  registration_enabled?: boolean | null;
  visibility?: ActivityVisibility | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface ActivityReadOptions {
  audience?: "authenticated" | "public";
}

interface ActivityImageRow {
  id: string;
  activity_id: string;
  image_url: string;
  sort_order: number;
  alt_text: string | null;
  is_cover: boolean | null;
}

interface ActivityParticipantRow {
  activity_id: string;
  athlete_id: string;
}

interface ActivityParticipantAthleteRow {
  id: string;
  name: string;
  profile_photo_url: string | null;
}

const ACTIVITY_DYNAMIC_WRITE_COLUMNS = [
  "schedule_mode",
  "schedule_label",
  "recurrence_interval",
  "recurrence_weekday",
  "recurrence_month_week",
  "recurrence_time",
  "logo_has_white_outline",
  "logo_url",
  "registration_closed",
  "registration_enabled",
  "visibility",
] as const;

const ACTIVITY_IMAGE_DYNAMIC_WRITE_COLUMNS = ["is_cover"] as const;

type ActivityDynamicWriteColumn = (typeof ACTIVITY_DYNAMIC_WRITE_COLUMNS)[number];
type ActivityImageDynamicWriteColumn = (typeof ACTIVITY_IMAGE_DYNAMIC_WRITE_COLUMNS)[number];

interface ActivityWriteOptions {
  omitColumns?: Iterable<ActivityDynamicWriteColumn>;
}

interface ActivityImageWriteOptions {
  omitColumns?: Iterable<ActivityImageDynamicWriteColumn>;
}

export class ActivityNotFoundError extends Error {
  constructor(message = "Kegiatan tidak ditemukan.") {
    super(message);
    this.name = "ActivityNotFoundError";
  }
}

function serializedSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return String(error ?? "").toLowerCase();
  }

  const candidate = error as {
    code?: unknown;
    details?: unknown;
    hint?: unknown;
    message?: unknown;
  };
  return [candidate.code, candidate.message, candidate.details, candidate.hint]
    .map((value) => String(value ?? ""))
    .join(" ")
    .toLowerCase();
}

export function isMissingActivityDynamicColumn(error: unknown): boolean {
  const text = serializedSupabaseError(error);

  return (
    (text.includes("schedule_mode") ||
      text.includes("schedule_label") ||
      text.includes("recurrence_interval") ||
      text.includes("recurrence_weekday") ||
      text.includes("recurrence_month_week") ||
      text.includes("recurrence_time") ||
      text.includes("logo_has_white_outline") ||
      text.includes("logo_url") ||
      text.includes("registration_closed") ||
      text.includes("registration_enabled") ||
      text.includes("visibility") ||
      text.includes("is_cover")) &&
    (text.includes("does not exist") || text.includes("schema cache") || text.includes("could not find") || text.includes("42703") || text.includes("pgrst204"))
  );
}

function addMissingDynamicColumns<TColumn extends string>(
  omittedColumns: Set<TColumn>,
  error: unknown,
  columns: readonly TColumn[],
): boolean {
  if (!isMissingActivityDynamicColumn(error)) {
    return false;
  }

  const text = serializedSupabaseError(error);
  let added = false;
  columns.forEach((column) => {
    if (text.includes(column.toLowerCase()) && !omittedColumns.has(column)) {
      omittedColumns.add(column);
      added = true;
    }
  });
  return added;
}

function normalizeDbTime(value: string | null): string | undefined {
  return value ? value.slice(0, 5) : undefined;
}

export function activityInsertDbPayload(payload: ActivityPayload, createdBy: string, options: ActivityWriteOptions = {}) {
  const omitColumns = new Set(options.omitColumns ?? []);
  const dbPayload: Record<string, unknown> = {
    activity_type: payload.activityType,
    created_by: createdBy,
    description: payload.description,
    documentation_url: payload.documentationUrl ?? null,
    location: payload.location,
    name: payload.name,
    sport_type: payload.sportType,
    starts_at: payload.startsAt ? new Date(payload.startsAt).toISOString() : null,
  };
  if (!omitColumns.has("logo_url")) {
    dbPayload.logo_url = payload.logoUrl ?? null;
  }
  if (!omitColumns.has("registration_closed")) {
    dbPayload.registration_closed = payload.registrationClosed;
  }
  if (!omitColumns.has("registration_enabled")) {
    dbPayload.registration_enabled = payload.registrationEnabled;
  }
  if (!omitColumns.has("logo_has_white_outline")) {
    dbPayload.logo_has_white_outline = payload.logoHasWhiteOutline;
  }
  if (!omitColumns.has("recurrence_interval")) {
    dbPayload.recurrence_interval = payload.recurrenceInterval ?? null;
  }
  if (!omitColumns.has("recurrence_month_week")) {
    dbPayload.recurrence_month_week = payload.recurrenceMonthWeek ?? null;
  }
  if (!omitColumns.has("recurrence_time")) {
    dbPayload.recurrence_time = payload.recurrenceTime ?? null;
  }
  if (!omitColumns.has("recurrence_weekday")) {
    dbPayload.recurrence_weekday = payload.recurrenceWeekday ?? null;
  }
  if (!omitColumns.has("schedule_label")) {
    dbPayload.schedule_label = payload.scheduleLabel ?? null;
  }
  if (!omitColumns.has("schedule_mode")) {
    dbPayload.schedule_mode = payload.scheduleMode;
  }
  if (!omitColumns.has("visibility")) {
    dbPayload.visibility = payload.visibility;
  }

  return dbPayload;
}

export async function insertActivityRecord(
  supabase: SupabaseServiceClient,
  payload: ActivityPayload,
  createdBy: string,
): Promise<{ id: string }> {
  const omittedColumns = new Set<ActivityDynamicWriteColumn>();
  let lastError: unknown;

  for (let attempt = 0; attempt <= ACTIVITY_DYNAMIC_WRITE_COLUMNS.length; attempt += 1) {
    const { data, error } = await supabase
      .from("activities")
      .insert(activityInsertDbPayload(payload, createdBy, { omitColumns: omittedColumns }))
      .select("id")
      .single();

    if (!error) {
      return data as { id: string };
    }

    lastError = error;
    if (!addMissingDynamicColumns(omittedColumns, error, ACTIVITY_DYNAMIC_WRITE_COLUMNS)) {
      throw error;
    }
  }

  throw lastError;
}

export function activityPatchDbPayload(payload: ActivityPatchPayload, options: ActivityWriteOptions = {}) {
  const omitColumns = new Set(options.omitColumns ?? []);
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) {
    patch.name = payload.name;
  }
  if (payload.activityType !== undefined) {
    patch.activity_type = payload.activityType;
  }
  if (payload.sportType !== undefined) {
    patch.sport_type = payload.sportType;
  }
  if (payload.description !== undefined) {
    patch.description = payload.description;
  }
  if (payload.location !== undefined) {
    patch.location = payload.location;
  }
  if (payload.startsAt !== undefined) {
    patch.starts_at = payload.startsAt ? new Date(payload.startsAt).toISOString() : null;
  }
  if (payload.scheduleMode !== undefined && !omitColumns.has("schedule_mode")) {
    patch.schedule_mode = payload.scheduleMode;
  }
  if ("scheduleLabel" in payload && !omitColumns.has("schedule_label")) {
    patch.schedule_label = payload.scheduleLabel ?? null;
  }
  if ("recurrenceInterval" in payload && !omitColumns.has("recurrence_interval")) {
    patch.recurrence_interval = payload.recurrenceInterval ?? null;
  }
  if ("recurrenceWeekday" in payload && !omitColumns.has("recurrence_weekday")) {
    patch.recurrence_weekday = payload.recurrenceWeekday ?? null;
  }
  if ("recurrenceMonthWeek" in payload && !omitColumns.has("recurrence_month_week")) {
    patch.recurrence_month_week = payload.recurrenceMonthWeek ?? null;
  }
  if ("recurrenceTime" in payload && !omitColumns.has("recurrence_time")) {
    patch.recurrence_time = payload.recurrenceTime ?? null;
  }
  if ("documentationUrl" in payload) {
    patch.documentation_url = payload.documentationUrl ?? null;
  }
  if ("logoUrl" in payload && !omitColumns.has("logo_url")) {
    patch.logo_url = payload.logoUrl ?? null;
  }
  if ("registrationClosed" in payload && !omitColumns.has("registration_closed")) {
    patch.registration_closed = payload.registrationClosed ?? false;
  }
  if ("registrationEnabled" in payload && !omitColumns.has("registration_enabled")) {
    patch.registration_enabled = payload.registrationEnabled ?? false;
  }
  if ("logoHasWhiteOutline" in payload && !omitColumns.has("logo_has_white_outline")) {
    patch.logo_has_white_outline = payload.logoHasWhiteOutline ?? false;
  }
  if (payload.visibility !== undefined && !omitColumns.has("visibility")) {
    patch.visibility = payload.visibility;
  }
  return patch;
}

export async function updateActivityRecord(
  supabase: SupabaseServiceClient,
  activityId: string,
  payload: ActivityPatchPayload,
): Promise<void> {
  const omittedColumns = new Set<ActivityDynamicWriteColumn>();
  let lastError: unknown;

  for (let attempt = 0; attempt <= ACTIVITY_DYNAMIC_WRITE_COLUMNS.length; attempt += 1) {
    const patch = activityPatchDbPayload(payload, { omitColumns: omittedColumns });
    if (!Object.keys(patch).length) {
      return;
    }

    const { data, error } = await supabase
      .from("activities")
      .update(patch)
      .eq("id", activityId)
      .select("id")
      .maybeSingle();
    if (!error && data) {
      return;
    }
    if (!error) {
      throw new ActivityNotFoundError();
    }

    lastError = error;
    if (!addMissingDynamicColumns(omittedColumns, error, ACTIVITY_DYNAMIC_WRITE_COLUMNS)) {
      throw error;
    }
  }

  throw lastError;
}

function groupImages(rows: ActivityImageRow[]): Map<string, ActivityImage[]> {
  const byActivity = new Map<string, ActivityImage[]>();
  rows.forEach((row) => {
    const images = byActivity.get(row.activity_id) ?? [];
    images.push({
      activityId: row.activity_id,
      altText: row.alt_text ?? undefined,
      id: row.id,
      imageUrl: row.image_url,
      isCover: Boolean(row.is_cover),
      sortOrder: row.sort_order,
    });
    byActivity.set(row.activity_id, images);
  });

  byActivity.forEach((images) => {
    images.sort((left, right) => left.sortOrder - right.sortOrder);
  });

  return byActivity;
}

function groupParticipants(
  rows: ActivityParticipantRow[],
  athletesById: Map<string, ActivityParticipantAthleteRow>,
): Map<string, ActivityParticipant[]> {
  const byActivity = new Map<string, ActivityParticipant[]>();
  rows.forEach((row) => {
    const athlete = athletesById.get(row.athlete_id);
    if (!athlete) {
      return;
    }

    const participants = byActivity.get(row.activity_id) ?? [];
    participants.push({
      athleteId: athlete.id,
      athleteName: athlete.name,
      profilePhotoUrl: athlete.profile_photo_url ?? undefined,
    });
    byActivity.set(row.activity_id, participants);
  });

  byActivity.forEach((participants) => {
    participants.sort((left, right) => left.athleteName.localeCompare(right.athleteName));
  });

  return byActivity;
}

function mapActivity(
  row: ActivityRow,
  imagesByActivity: Map<string, ActivityImage[]>,
  participantsByActivity: Map<string, ActivityParticipant[]>,
  currentAthleteId?: string,
): ActivityDetails {
  const participants = participantsByActivity.get(row.id) ?? [];
  const scheduleMode = row.schedule_mode ?? "single";
  const visibility = row.visibility === "public" ? "public" : "internal";
  const registration = activityRegistrationState({
    registrationClosed: Boolean(row.registration_closed),
    registrationEnabled: Boolean(row.registration_enabled),
    startsAt: row.starts_at ?? undefined,
    visibility,
  });
  const activity: ActivityDetails = {
    activityType: row.activity_type,
    createdAt: row.created_at,
    createdBy: row.created_by ?? undefined,
    currentAthleteParticipant: currentAthleteId ? participants.some((participant) => participant.athleteId === currentAthleteId) : false,
    description: row.description,
    documentationUrl: row.documentation_url ?? undefined,
    displaySchedule: "",
    id: row.id,
    images: imagesByActivity.get(row.id) ?? [],
    location: row.location,
    logoHasWhiteOutline: Boolean(row.logo_has_white_outline),
    logoUrl: row.logo_url ?? undefined,
    name: row.name,
    participants,
    registrationClosed: Boolean(row.registration_closed),
    registrationClosedReason: registration.closedReason,
    registrationEnabled: Boolean(row.registration_enabled),
    registrationOpen: registration.isOpen,
    recurrenceInterval: row.recurrence_interval ?? undefined,
    recurrenceMonthWeek: row.recurrence_month_week ?? undefined,
    recurrenceTime: normalizeDbTime(row.recurrence_time),
    recurrenceWeekday: row.recurrence_weekday ?? undefined,
    scheduleLabel: row.schedule_label ?? undefined,
    scheduleMode,
    sportType: row.sport_type,
    startsAt: row.starts_at ?? undefined,
    updatedAt: row.updated_at,
    visibility,
  };
  activity.displaySchedule = formatActivitySchedule(activity);
  activity.coverImageUrl = coverImageForActivity(activity)?.imageUrl;
  return activity;
}

const ACTIVITY_SELECT_COLUMNS = [
  "id",
  "name",
  "activity_type",
  "sport_type",
  "description",
  "location",
  "starts_at",
  "schedule_mode",
  "schedule_label",
  "recurrence_interval",
  "recurrence_weekday",
  "recurrence_month_week",
  "recurrence_time",
  "documentation_url",
  "logo_has_white_outline",
  "logo_url",
  "registration_closed",
  "registration_enabled",
  "visibility",
  "created_by",
  "created_at",
  "updated_at",
] as const;
const LEGACY_ACTIVITY_SELECT_COLUMNS =
  "id,name,activity_type,sport_type,description,location,starts_at,documentation_url,created_by,created_at,updated_at";

function activitySelectColumns(options: ActivityWriteOptions = {}): string {
  const omitColumns = new Set(options.omitColumns ?? []);
  return ACTIVITY_SELECT_COLUMNS.filter((column) => !omitColumns.has(column as ActivityDynamicWriteColumn)).join(",");
}

async function fetchActivityImages(supabase: SupabaseServiceClient, activityIds: string[]): Promise<ActivityImageRow[]> {
  const { data, error } = await supabase
    .from("activity_images")
    .select("id,activity_id,image_url,sort_order,alt_text,is_cover")
    .in("activity_id", activityIds)
    .order("sort_order", { ascending: true });

  if (!error) {
    return (data ?? []) as ActivityImageRow[];
  }

  if (!isMissingActivityDynamicColumn(error)) {
    throw error;
  }

  const { data: legacyData, error: legacyError } = await supabase
    .from("activity_images")
    .select("id,activity_id,image_url,sort_order,alt_text")
    .in("activity_id", activityIds)
    .order("sort_order", { ascending: true });

  if (legacyError) {
    throw legacyError;
  }

  return ((legacyData ?? []) as Omit<ActivityImageRow, "is_cover">[]).map((row) => ({ ...row, is_cover: false }));
}

export async function composeActivities(
  supabase: SupabaseServiceClient,
  rows: ActivityRow[],
  currentAthleteId?: string,
): Promise<ActivityDetails[]> {
  if (!rows.length) {
    return [];
  }

  const activityIds = rows.map((row) => row.id);
  const [imageRows, { data: participantRows, error: participantsError }] = await Promise.all([
    fetchActivityImages(supabase, activityIds),
    supabase
      .from("activity_participants")
      .select("activity_id,athlete_id")
      .in("activity_id", activityIds),
  ]);

  if (participantsError) {
    throw participantsError;
  }

  const participants = (participantRows ?? []) as ActivityParticipantRow[];
  const athleteIds = Array.from(new Set(participants.map((row) => row.athlete_id)));
  let athletesById = new Map<string, ActivityParticipantAthleteRow>();
  if (athleteIds.length) {
    const { data: athleteRows, error: athletesError } = await supabase
      .from("athletes")
      .select("id,name,profile_photo_url")
      .in("id", athleteIds);
    if (athletesError) {
      throw athletesError;
    }
    athletesById = new Map(((athleteRows ?? []) as ActivityParticipantAthleteRow[]).map((athlete) => [athlete.id, athlete]));
  }

  const imagesByActivity = groupImages(imageRows);
  const participantsByActivity = groupParticipants(participants, athletesById);

  return rows.map((row) => mapActivity(row, imagesByActivity, participantsByActivity, currentAthleteId));
}

async function listLegacyActivities(supabase: SupabaseServiceClient, currentAthleteId?: string): Promise<ActivityDetails[]> {
  const { data: legacyData, error: legacyError } = await supabase
    .from("activities")
    .select(LEGACY_ACTIVITY_SELECT_COLUMNS)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (legacyError) {
    throw legacyError;
  }

  return composeActivities(supabase, (legacyData ?? []) as ActivityRow[], currentAthleteId);
}

async function getLegacyActivityById(
  supabase: SupabaseServiceClient,
  activityId: string,
  currentAthleteId?: string,
): Promise<ActivityDetails | null> {
  const { data: legacyData, error: legacyError } = await supabase
    .from("activities")
    .select(LEGACY_ACTIVITY_SELECT_COLUMNS)
    .eq("id", activityId)
    .single();

  if (!legacyError) {
    const [activity] = await composeActivities(supabase, [legacyData as ActivityRow], currentAthleteId);
    return activity ?? null;
  }
  if (legacyError.code === "PGRST116") {
    return null;
  }
  throw legacyError;
}

export async function listActivities(
  supabase: SupabaseServiceClient,
  currentAthleteId?: string,
  options: ActivityReadOptions = {},
): Promise<ActivityDetails[]> {
  const omittedColumns = new Set<ActivityDynamicWriteColumn>();

  for (let attempt = 0; attempt <= ACTIVITY_DYNAMIC_WRITE_COLUMNS.length; attempt += 1) {
    if (options.audience === "public" && omittedColumns.has("visibility")) {
      return [];
    }

    let query = supabase
      .from("activities")
      .select(activitySelectColumns({ omitColumns: omittedColumns }));

    if (options.audience === "public") {
      query = query.eq("visibility", "public");
    }

    const { data, error } = await query
      .order("starts_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error) {
      return composeActivities(supabase, (data ?? []) as unknown as ActivityRow[], currentAthleteId);
    }

    if (!addMissingDynamicColumns(omittedColumns, error, ACTIVITY_DYNAMIC_WRITE_COLUMNS)) {
      throw error;
    }
  }

  return options.audience === "public" ? [] : listLegacyActivities(supabase, currentAthleteId);
}

export async function getActivityById(
  supabase: SupabaseServiceClient,
  activityId: string,
  currentAthleteId?: string,
  options: ActivityReadOptions = {},
): Promise<ActivityDetails | null> {
  const omittedColumns = new Set<ActivityDynamicWriteColumn>();

  for (let attempt = 0; attempt <= ACTIVITY_DYNAMIC_WRITE_COLUMNS.length; attempt += 1) {
    if (options.audience === "public" && omittedColumns.has("visibility")) {
      return null;
    }

    let query = supabase
      .from("activities")
      .select(activitySelectColumns({ omitColumns: omittedColumns }))
      .eq("id", activityId);

    if (options.audience === "public") {
      query = query.eq("visibility", "public");
    }

    const { data, error } = await query.single();

    if (!error) {
      const [activity] = await composeActivities(supabase, [data as unknown as ActivityRow], currentAthleteId);
      return activity ?? null;
    }

    if (error.code === "PGRST116") {
      return null;
    }

    if (!addMissingDynamicColumns(omittedColumns, error, ACTIVITY_DYNAMIC_WRITE_COLUMNS)) {
      throw error;
    }
  }

  if (options.audience === "public") {
    return null;
  }
  return getLegacyActivityById(supabase, activityId, currentAthleteId);
}

export async function replaceActivityImages(
  supabase: SupabaseServiceClient,
  activityId: string,
  images: ActivityPayload["images"],
): Promise<void> {
  const { error: deleteError } = await supabase.from("activity_images").delete().eq("activity_id", activityId);
  if (deleteError) {
    throw deleteError;
  }

  if (!images.length) {
    return;
  }

  const omittedColumns = new Set<ActivityImageDynamicWriteColumn>();
  let lastError: unknown;

  for (let attempt = 0; attempt <= ACTIVITY_IMAGE_DYNAMIC_WRITE_COLUMNS.length; attempt += 1) {
    const { error: insertError } = await supabase
      .from("activity_images")
      .insert(activityImageInsertRows(activityId, images, { omitColumns: omittedColumns }));
    if (!insertError) {
      return;
    }

    lastError = insertError;
    if (!addMissingDynamicColumns(omittedColumns, insertError, ACTIVITY_IMAGE_DYNAMIC_WRITE_COLUMNS)) {
      throw insertError;
    }
  }

  throw lastError;
}

function activityImageInsertRows(
  activityId: string,
  images: ActivityPayload["images"],
  options: ActivityImageWriteOptions = {},
) {
  const omitColumns = new Set(options.omitColumns ?? []);
  const coverIndex = images.findIndex((image) => image.isCover);
  return images.map((image, index) => {
    const row: Record<string, unknown> = {
      activity_id: activityId,
      alt_text: image.altText ?? null,
      image_url: image.imageUrl,
      sort_order: image.sortOrder ?? index,
    };
    if (!omitColumns.has("is_cover")) {
      row.is_cover = coverIndex >= 0 ? index === coverIndex : index === 0;
    }
    return row;
  });
}

export async function replaceActivityParticipants(
  supabase: SupabaseServiceClient,
  activityId: string,
  athleteIds: string[],
  assignedBy: string,
): Promise<void> {
  const { error: deleteError } = await supabase.from("activity_participants").delete().eq("activity_id", activityId);
  if (deleteError) {
    throw deleteError;
  }

  const uniqueAthleteIds = Array.from(new Set(athleteIds));
  if (!uniqueAthleteIds.length) {
    return;
  }

  const { error: insertError } = await supabase.from("activity_participants").insert(
    uniqueAthleteIds.map((athleteId) => ({
      activity_id: activityId,
      assigned_by: assignedBy,
      athlete_id: athleteId,
    })),
  );
  if (insertError) {
    throw insertError;
  }
}

export class ActivityRegistrationError extends Error {
  code: "closed" | "duplicate" | "not_found" | "unlinked";
  status: number;

  constructor(code: ActivityRegistrationError["code"], message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function isDuplicateGuestRegistration(error: unknown): boolean {
  const text = serializedSupabaseError(error);
  return (
    text.includes("23505") ||
    text.includes("activity_guest_registrations_activity_id_normalized_phone_key") ||
    text.includes("duplicate key")
  );
}

export async function requireOpenActivityRegistration(
  supabase: SupabaseServiceClient,
  activityId: string,
  currentAthleteId?: string,
): Promise<ActivityDetails> {
  const activity = await getActivityById(supabase, activityId, currentAthleteId, {
    audience: "public",
  });
  if (!activity) {
    throw new ActivityRegistrationError("not_found", "Kegiatan tidak ditemukan.", 404);
  }
  if (!activity.registrationOpen) {
    throw new ActivityRegistrationError("closed", "Pendaftaran kegiatan sudah ditutup.", 409);
  }
  return activity;
}

export async function registerGuestActivity(
  supabase: SupabaseServiceClient,
  activityId: string,
  payload: ActivityGuestRegistrationPayload,
): Promise<ActivityDetails> {
  const activity = await requireOpenActivityRegistration(supabase, activityId);
  const { error } = await supabase.from("activity_guest_registrations").insert({
    activity_id: activityId,
    community: payload.community,
    guest_name: payload.name,
    normalized_phone: normalizeRegistrationPhone(payload.phone),
    phone: payload.phone,
  });

  if (error) {
    if (isDuplicateGuestRegistration(error)) {
      throw new ActivityRegistrationError("duplicate", "No HP ini sudah terdaftar untuk kegiatan ini.", 409);
    }
    throw error;
  }

  return activity;
}

export async function registerAuthenticatedActivity(
  supabase: SupabaseServiceClient,
  activityId: string,
  athleteId: string,
  userId: string,
): Promise<ActivityDetails> {
  await requireOpenActivityRegistration(supabase, activityId, athleteId);

  const { error } = await supabase.from("activity_participants").upsert(
    {
      activity_id: activityId,
      assigned_by: userId,
      athlete_id: athleteId,
    },
    { ignoreDuplicates: true, onConflict: "activity_id,athlete_id" },
  );

  if (error) {
    throw error;
  }

  const activity = await getActivityById(supabase, activityId, athleteId);
  if (!activity) {
    throw new ActivityRegistrationError("not_found", "Kegiatan tidak ditemukan.", 404);
  }
  return activity;
}
