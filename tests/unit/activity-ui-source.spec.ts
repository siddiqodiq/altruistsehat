import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function componentFunction(sourceText: string, functionName: string) {
  const start = sourceText.indexOf(`function ${functionName}`);
  const next = sourceText.indexOf("\nfunction ", start + 1);

  return sourceText.slice(start, next === -1 ? undefined : next);
}

test("public activities split into event and calendar routes with kegiatan redirect", () => {
  const eventRoute = source("src/app/event/page.tsx");
  const calendarRoute = source("src/app/kalender/page.tsx");
  const legacyRoute = source("src/app/kegiatan/page.tsx");

  expect(eventRoute).toContain('<ActivitiesPage mode="events" />');
  expect(calendarRoute).toContain('<ActivitiesPage mode="calendar" />');
  expect(legacyRoute).toContain('redirect("/event")');
});

test("public activities page exposes event and calendar modes only", () => {
  const page = source("src/components/activities/ActivitiesPage.tsx");

  expect(page).toContain('type ActivitiesPageMode = "events" | "calendar"');
  expect(page).toContain('export function ActivitiesPage({ mode = "events" }');
  expect(page).toContain('mode === "events"');
  expect(page).toContain('mode === "calendar"');
  expect(page).toContain("activityOccurrencesForMonth");
  expect(page).not.toContain("ActivityViewMode");
  expect(page).not.toContain("VIEW_MODES");
  expect(page).not.toContain("setViewMode");
  expect(page).not.toContain('id: "list"');
  expect(page).not.toContain('id: "timeline"');
});

test("public activities page uses event and calendar page titles", () => {
  const page = source("src/components/activities/ActivitiesPage.tsx");
  const detailPage = source("src/components/activities/ActivityDetailPage.tsx");

  expect(page).toContain("<h1");
  expect(page).toContain("Event");
  expect(page).toContain("Kalender");
  expect(page).not.toContain("Kegiatan yang kami ikuti");
  expect(detailPage).not.toContain("Kegiatan yang kami ikuti");
  expect(page).not.toContain('label: "Timeline"');
  expect(page).not.toContain("Agenda Komunitas");
  expect(page).not.toContain("Lihat kalender, dokumentasi, dan lini masa kegiatan komunitas.");
  expect(page).not.toContain('label: "Lini masa"');
  expect(page).not.toContain("Login untuk join");
  expect(page).not.toContain("/auth/login?next=/kegiatan");
  expect(page).not.toContain("uppercase tracking-[0.16em]");
});

test("public activities page keeps coming soon separate and hides routine cards for now", () => {
  const page = source("src/components/activities/ActivitiesPage.tsx");

  expect(page).toContain("const comingSoonActivities");
  expect(page).toContain('activity.scheduleMode === "coming_soon"');
  expect(page).toContain("Coming Soon");
  expect(page).not.toContain("Rutin & Coming Soon");
  expect(page).not.toContain("flexibleActivities");
});

test("public activities page removes list and timeline surfaces", () => {
  const page = source("src/components/activities/ActivitiesPage.tsx");

  expect(page).not.toContain("const timelineActivities");
  expect(page).not.toContain("activityHasDate");
  expect(page).not.toContain('viewMode === "list"');
  expect(page).not.toContain('viewMode === "timeline"');
});

test("public activities page links activity entries to a standalone detail page", () => {
  const page = source("src/components/activities/ActivitiesPage.tsx");
  const detailRoute = source("src/app/kegiatan/[id]/page.tsx");
  const detailPage = source("src/components/activities/ActivityDetailPage.tsx");
  const pieces = source("src/components/activities/ActivityPieces.tsx");

  expect(page).toContain("import Link from \"next/link\"");
  expect(page).toContain("href={`/kegiatan/${activity.id}`}");
  expect(page).toContain("href={`/kegiatan/${activity.id}/daftar`}");
  expect(page).toContain("href={`/kegiatan/${occurrence.activityId}`}");
  expect(page).toContain("Daftar");
  expect(page).toContain("Event Closed");
  expect(page).not.toContain("import { Modal }");
  expect(page).not.toContain("detailModalOpen");
  expect(page).not.toContain("function openActivityDetail");
  expect(page).not.toContain("<ActivityDetail");
  expect(page).not.toContain("lg:grid-cols-[minmax(0,1fr)_360px]");
  expect(page).not.toContain("lg:grid-cols-[minmax(0,430px)_1fr]");
  expect(page).not.toContain("selectedTimelineActivity");
  expect(detailRoute).toContain("ActivityDetailPage");
  expect(detailRoute).toContain("params: Promise<{ id: string }>");
  expect(detailPage).toContain("export function ActivityDetailPage({ activityId }");
  expect(detailPage).toContain("listActivities");
  expect(detailPage).not.toContain("joinActivity");
  expect(detailPage).not.toContain("leaveActivity");
  expect(detailPage).toContain("const suggestedActivities");
  expect(detailPage).toContain("Kegiatan lainnya");
  expect(detailPage).toContain('href="/event"');
  expect(detailPage).toContain("href={`/kegiatan/${activity.id}`}");
  expect(pieces).toContain("href={`/kegiatan/${activity.id}/daftar`}");
});

test("public event grid relies on API visibility and groups authenticated activities by category", () => {
  const page = source("src/components/activities/ActivitiesPage.tsx");
  const detail = source("src/components/activities/ActivityDetailPage.tsx");
  const pieces = source("src/components/activities/ActivityPieces.tsx");

  expect(page).toContain("groupActivitiesByActivityType");
  expect(page).toContain("const eventGroups");
  expect(page).toContain("eventGroups.map");
  expect(page).toContain("orderedActivities.map");
  expect(page).toContain("const [authenticated, setAuthenticated]");
  expect(page).toContain("setAuthenticated(payload.authenticated)");
  expect(page).toContain("authenticated ? (");
  expect(page).toContain("activity.description");
  expect(page).not.toContain("altruistPublicEventActivities");
  expect(detail).not.toContain("altruistPublicEventActivities");
  expect(pieces).toContain("!authenticated && !activity.registrationOpen");
});

test("activity registration page separates guest form and logged-in confirmation flow", () => {
  const route = source("src/app/kegiatan/[id]/daftar/page.tsx");
  const page = source("src/components/activities/ActivityRegistrationPage.tsx");
  const api = source("src/lib/activities/api.ts");
  const registrationRoute = source("src/app/api/activities/[id]/registrations/route.ts");

  expect(route).toContain("ActivityRegistrationPage");
  expect(page).toContain("Nama");
  expect(page).toContain("No HP");
  expect(page).toContain("Komunitas");
  expect(page).toContain("Umum");
  expect(page).toContain("Konfirmasi pendaftaran");
  expect(page).toContain("registerActivity");
  expect(api).toContain("registerActivity");
  expect(api).toContain("/registrations");
  expect(registrationRoute).toContain("ActivityGuestRegistrationPayloadSchema");
  expect(registrationRoute).toContain("registerGuestActivity");
  expect(registrationRoute).toContain("registerAuthenticatedActivity");
});

test("public and homepage activity surfaces use the shared logo-aware title component", () => {
  const activities = source("src/components/activities/ActivitiesPage.tsx");
  const globals = source("src/app/globals.css");
  const title = source("src/components/activities/ActivityLogoTitle.tsx");
  const features = source("src/components/Features.tsx");
  const timeline = source("src/components/Timeline.tsx");

  expect(title).toContain("export function ActivityLogoTitle");
  expect(title).toContain("activity.logoUrl");
  expect(title).toContain("activity.logoHasWhiteOutline");
  expect(title).toContain("activity-logo-white-outline");
  expect(title).toContain("object-contain");
  expect(globals).toContain(".activity-logo-white-outline");
  expect(globals).toContain("drop-shadow");
  expect(activities).toContain("ActivityLogoTitle");
  expect(features).toContain("ActivityLogoTitle");
  expect(timeline).toContain("ActivityLogoTitle");
  expect(features).toContain("href={`/kegiatan/${activity.id}`}");
  expect(timeline).toContain("href={`/kegiatan/${item.id}`}");
  expect(activities).not.toContain("<h2 className=\"mt-3 font-poppins text-3xl font-black tracking-normal text-primary-charcoal dark:text-gray-100\">");
});

test("admin activities panel exposes recurrence controls, cover selection, and logo management", () => {
  const admin = source("src/components/admin/ActivityAdminPanel.tsx");

  expect(admin).toContain("ACTIVITY_VISIBILITY_OPTIONS");
  expect(admin).toContain("visibility");
  expect(admin).toContain("Visibilitas");
  expect(admin).toContain("Internal");
  expect(admin).toContain("Publik");
  expect(admin).toContain("tampil untuk guest");
  expect(admin).toContain("event eksternal");
  expect(admin).toContain("scheduleMode");
  expect(admin).toContain("recurrenceInterval");
  expect(admin).toContain("recurrenceWeekday");
  expect(admin).toContain("recurrenceMonthWeek");
  expect(admin).toContain("setCoverImage");
  expect(admin).toContain("Jadikan sampul");
  expect(admin).toContain("logoUrl");
  expect(admin).toContain("Logo kegiatan");
  expect(admin).toContain("uploadLogoFile");
  expect(admin).toContain("Hapus logo");
  expect(admin).toContain("logoHasWhiteOutline");
  expect(admin).toContain("Outline putih");
  expect(admin).toContain("checked={form.logoHasWhiteOutline}");
  expect(admin).toContain("activity-logo-white-outline");
  expect(admin).toContain("registrationEnabled");
  expect(admin).toContain("registrationClosed");
  expect(admin).toContain("Buka pendaftaran");
  expect(admin).toContain("Tutup manual");
  expect(admin).toContain("Event Closed");
  expect(admin).toContain("Jenis olahraga");
  expect(admin).toContain("tandai anggota yang ikut");
  expect(admin).not.toContain("assign atlet");
  expect(admin).not.toContain("Sport type");
});

test("admin activities panel shows failures in a visible popup alert", () => {
  const admin = source("src/components/admin/ActivityAdminPanel.tsx");

  expect(admin).toContain("alertMessage");
  expect(admin).toContain("showError");
  expect(admin).toContain('role="alert"');
  expect(admin).toContain("Tutup");
});

test("activities API requests use public audience filtering for guests", () => {
  const indexRoute = source("src/app/api/activities/route.ts");
  const detailRoute = source("src/app/api/activities/[id]/route.ts");
  const participantsRoute = source("src/app/api/activities/[id]/participants/me/route.ts");
  const homeRoute = source("src/app/api/activities/home/route.ts");
  const server = source("src/lib/activities/server.ts");

  expect(indexRoute).toContain('audience: profile ? "authenticated" : "public"');
  expect(detailRoute).toContain('audience: profile ? "authenticated" : "public"');
  expect(homeRoute).toContain("homeSportTypes");
  expect(homeRoute).toContain("homeSportVisuals");
  expect(homeRoute).toContain("homeDocumentationCovers");
  expect(homeRoute).toContain("toPublicActivityPayload");
  expect(homeRoute).toContain('activity.visibility === "public"');
  expect(server).toContain('audience?: "authenticated" | "public"');
  expect(server).toContain('.eq("visibility", "public")');
  expect(server).toContain('activitySelectColumns({ omitColumns: omittedColumns })');
  expect(server).toContain('omittedColumns.has("visibility")');
  expect(server).toContain('return options.audience === "public" ? []');
  expect(participantsRoute).toContain("registerAuthenticatedActivity");
});

test("homepage activity sections are backed by one activities API fetch", () => {
  const home = source("src/app/page.tsx");
  const homeSections = source("src/components/HomeActivitySections.tsx");
  const timeline = source("src/components/Timeline.tsx");

  expect(home).toContain("HomeActivitySections");
  expect(home).not.toContain("ValueProposition");
  expect(home).not.toContain("LifestyleGallery");
  expect(homeSections).toContain("listHomeActivities");
  expect(homeSections).toContain("sportVisuals");
  expect(homeSections).toContain("documentationCovers");
  expect(homeSections).toContain("<ValueProposition");
  expect(homeSections).toContain("<Features");
  expect(homeSections).toContain("<LifestyleGallery");
  expect(homeSections).toContain("<Timeline");
  expect(timeline).not.toContain("const timelineData");
});

test("homepage sports and documentation sections no longer use static activity content", () => {
  const sports = source("src/components/ValueProposition.tsx");
  const gallery = source("src/components/LifestyleGallery.tsx");

  expect(sports).toContain("sportVisuals");
  expect(sports).not.toContain("activityCount");
  expect(sports).not.toContain("const values =");
  expect(sports).not.toContain("SportShoe");
  expect(sports).not.toContain("Dumbbell");
  expect(sports).not.toContain("sportIcon");
  expect(gallery).toContain("documentationCovers");
  expect(gallery).not.toContain("activityName");
  expect(gallery).not.toContain("activityId");
  expect(gallery).not.toContain("../assets/kolase");
});

test("homepage sports section uses an editorial diagonal photo strip instead of icon cards", () => {
  const sports = source("src/components/ValueProposition.tsx");

  expect(sports).toContain("Beragam cara untuk bergerak bersama.");
  expect(sports).toContain("overflow-x-auto");
  expect(sports).toContain("clipPath");
  expect(sports).toContain("skew");
  expect(sports).toContain("sportVisual.imageUrl");
  expect(sports).toContain("object-cover");
  expect(sports).toContain("shrink-0");
  expect(sports).not.toContain("Pilihan gerak yang sedang ramai di komunitas");
  expect(sports).not.toContain("grid grid-cols-2");
  expect(sports).not.toContain("rounded-xl bg-secondary-sand/20");
});

test("homepage documentation gallery does not render admin cover labels", () => {
  const gallery = source("src/components/LifestyleGallery.tsx");

  expect(gallery).not.toContain(">Cover<");
  expect(gallery).not.toContain('"Cover"');
});

test("public activity surfaces use visitor-friendly copy without admin or backend language", () => {
  const activities = source("src/components/activities/ActivitiesPage.tsx");
  const activityDetail = source("src/components/activities/ActivityDetailPage.tsx");
  const activityPieces = source("src/components/activities/ActivityPieces.tsx");
  const features = source("src/components/Features.tsx");
  const gallery = source("src/components/LifestyleGallery.tsx");
  const timeline = source("src/components/Timeline.tsx");
  const sports = source("src/components/ValueProposition.tsx");
  const homeContent = source("src/lib/activities/home-activity-content.ts");
  const hero = source("src/components/Hero.tsx");

  const publicCopy = [activities, activityDetail, activityPieces, features, gallery, timeline, sports, homeContent, hero].join("\n");

  expect(activities).toContain("Kalender");
  expect(activities).toContain("Event");
  expect(activities).toContain("Daftar");
  expect(activities).not.toContain("Timeline");
  expect(activities).not.toContain("Kegiatan yang kami ikuti");
  expect(activityDetail).toContain("Kegiatan");
  expect(activityDetail).not.toContain("Kegiatan yang kami ikuti");
  expect(activityPieces).toContain("Daftar");
  expect(activityPieces).toContain("Event Closed");
  expect(activityPieces).not.toContain("Ikut kegiatan");
  expect(activityPieces).not.toContain("Batal ikut");
  expect(activityPieces).toContain("Lihat dokumentasi");
  expect(hero).toContain("Gabung bareng");
  expect(timeline).toContain("Cerita Kegiatan");
  expect(publicCopy).not.toContain("backend");
  expect(publicCopy).not.toContain("database leaderboard");
  expect(publicCopy).not.toContain("dikelola admin");
  expect(publicCopy).not.toContain("diunggah admin");
  expect(publicCopy).not.toContain("Our Timeline Activity");
  expect(publicCopy).not.toContain("Join with us");
});

test("activity detail page uses an immersive hero and collapsed documentation preview", () => {
  const detailPage = source("src/components/activities/ActivityDetailPage.tsx");
  const pieces = source("src/components/activities/ActivityPieces.tsx");

  expect(detailPage).toContain('className="w-full bg-primary-beige pb-24');
  expect(detailPage).not.toContain('className="topbar-clearance w-full bg-primary-beige');
  expect(detailPage).toContain("fallbackShellClassName");
  expect(detailPage).toContain("px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12");
  expect(detailPage).not.toContain("max-w-[1400px]");
  expect(detailPage).not.toContain("ArrowLeft");
  expect(detailPage).not.toContain(">Kembali ke kegiatan<");
  expect(pieces).toContain("function ActivityHero");
  expect(pieces).toContain("function DocumentationPreview");
  expect(pieces).toContain("function ActivityLightbox");
  expect(pieces).toContain("heroImageUrl");
  expect(pieces).toContain("min-h-screen");
  expect(pieces).toContain("topbar-clearance");
  expect(pieces).toContain("bg-gradient-to-r from-black/85");
  expect(pieces).toContain("bg-gradient-to-t from-black/95");
  expect(pieces).toContain("line-clamp-3");
  expect(pieces).toContain("Lihat semua foto");
  expect(pieces).toContain("hiddenPhotoCount");
  expect(pieces).toContain("authenticated && galleryImages.length");
  expect(pieces).not.toContain("xl:rounded-2xl");
  expect(pieces).not.toContain("rounded-2xl border border-secondary-sand/70 bg-white/90");
  expect(pieces).not.toContain("activity.images.map((image) => (");
});

test("activity detail hero uses event logo without duplicating the event title", () => {
  const pieces = source("src/components/activities/ActivityPieces.tsx");

  expect(pieces).toContain("ActivityLogoTitle");
  expect(pieces).toContain('as="h1"');
  expect(pieces).toContain("logoClassName");
  expect(pieces).not.toContain("activity.logoUrl ? (");
  expect(pieces).not.toContain("{activity.name}</p>");
});

test("activity detail documentation lightbox supports focused image browsing", () => {
  const pieces = source("src/components/activities/ActivityPieces.tsx");

  expect(pieces).toContain("useModalA11y");
  expect(pieces).toContain('event.key === "ArrowRight"');
  expect(pieces).toContain('event.key === "ArrowLeft"');
  expect(pieces).toContain('aria-label="Tutup dokumentasi"');
  expect(pieces).toContain('aria-label="Foto sebelumnya"');
  expect(pieces).toContain('aria-label="Foto berikutnya"');
  expect(pieces).toContain("{activePhotoIndex + 1} / {galleryImages.length}");
  expect(pieces).toContain("onClick={closeLightbox}");
});

test("homepage documentation gallery follows photo aspect ratio without crop or hover zoom", () => {
  const galleryRow = componentFunction(source("src/components/LifestyleGallery.tsx"), "GalleryRow");

  expect(galleryRow).toContain("h-full w-auto max-w-none");
  expect(galleryRow).not.toContain("object-cover");
  expect(galleryRow).not.toContain("hover:scale");
  expect(galleryRow).not.toContain("galleryRatio");
  expect(galleryRow).not.toContain("aspect-[");
});
