"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, ImageIcon, MapPin, Users, X } from "lucide-react";
import type { ActivityListItem } from "@/lib/activities/api";
import { ACTIVITY_TYPES } from "@/lib/activities/schema";
import { ActivityLogoTitle } from "@/components/activities/ActivityLogoTitle";
import { useModalA11y } from "@/hooks/useModalA11y";
import { cn } from "@/lib/utils";

type ActivityGalleryImage = ActivityListItem["images"][number];

export function activityAccent(activityType: string) {
  const index = ACTIVITY_TYPES.findIndex((item) => item === activityType);
  return [
    "border-primary-green/25 bg-primary-green/10 text-primary-green",
    "border-primary-brown/25 bg-primary-brown/10 text-primary-brown",
    "border-secondary-clay/25 bg-secondary-clay/10 text-secondary-clay",
  ][Math.max(index, 0)];
}

export function sortedActivities(activities: ActivityListItem[]): ActivityListItem[] {
  return [...activities].sort((left, right) => {
    const leftTime = left.startsAt ? Date.parse(left.startsAt) : 0;
    const rightTime = right.startsAt ? Date.parse(right.startsAt) : 0;
    return rightTime - leftTime || left.name.localeCompare(right.name);
  });
}

export function ActivityCover({ activity, compact = false }: { activity: ActivityListItem; compact?: boolean }) {
  const imageUrl = activity.coverImageUrl ?? activity.images[0]?.imageUrl;
  return (
    <div className={cn("overflow-hidden rounded-xl bg-secondary-sand/25 dark:bg-zinc-800", compact ? "aspect-square" : "aspect-[4/3]")}>
      {imageUrl ? (
        <img alt={`${activity.name} cover`} className="h-full w-full object-cover" src={imageUrl} />
      ) : (
        <div className="grid h-full w-full place-items-center text-primary-charcoal/45 dark:text-gray-500">
          <ImageIcon className="size-8" />
        </div>
      )}
    </div>
  );
}

export function ActivityMeta({ activity }: { activity: ActivityListItem }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className={cn("rounded-full border px-3 py-1 text-xs font-black", activityAccent(activity.activityType))}>
        {activity.activityType}
      </span>
      <span className="rounded-full border border-secondary-sand/70 px-3 py-1 text-xs font-black text-primary-charcoal/65 dark:border-zinc-700 dark:text-gray-300">
        {activity.sportType}
      </span>
    </div>
  );
}

export function ActivityHero({
  activity,
  authenticated,
}: {
  activity: ActivityListItem;
  authenticated: boolean;
}) {
  const heroImageUrl = activity.coverImageUrl ?? activity.images[0]?.imageUrl;

  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-primary-charcoal text-white">
      {heroImageUrl ? (
        <img alt={`${activity.name} cover`} className="absolute inset-0 h-full w-full object-cover" src={heroImageUrl} />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-primary-charcoal text-white/35">
          <ImageIcon className="size-12" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/35 to-transparent" />

      <div className="topbar-clearance relative z-10 flex min-h-screen w-full flex-col justify-end px-4 pb-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="max-w-3xl">
          <ActivityLogoTitle
            activity={activity}
            as="h1"
            className="max-w-[min(680px,88vw)]"
            fallbackClassName="font-poppins text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl lg:text-6xl"
            logoClassName="max-h-28 w-auto sm:max-h-36 lg:max-h-44"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-bold text-white/80">
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{activity.activityType}</span>
          <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{activity.sportType}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-bold text-white/80">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" />
            {activity.displaySchedule}
          </span>
          <span className="inline-flex items-center gap-2">
            <MapPin className="size-4" />
            {activity.location}
          </span>
        </div>

        <p className="mt-5 line-clamp-3 max-w-2xl text-base leading-8 text-white/85">
          {activity.description}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          {authenticated && "currentAthleteParticipant" in activity && activity.currentAthleteParticipant ? (
            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-black text-white">
              <CheckCircle2 className="size-4" />
              Anda terdaftar
            </span>
          ) : null}
          {activity.registrationOpen ? (
            <Link
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-black text-primary-charcoal transition hover:bg-secondary-sand"
              href={`/kegiatan/${activity.id}/daftar`}
            >
              Daftar
            </Link>
          ) : !authenticated && !activity.registrationOpen ? (
            <button
              className="inline-flex h-11 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-white/15 bg-white/15 px-5 text-sm font-black text-white/75"
              disabled
              type="button"
            >
              Event Closed
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function DocumentationPreview({
  activityName,
  galleryImages,
  onOpenLightbox,
}: {
  activityName: string;
  galleryImages: ActivityGalleryImage[];
  onOpenLightbox: (index: number) => void;
}) {
  if (!galleryImages.length) {
    return null;
  }

  const previewImages = galleryImages.slice(0, Math.min(galleryImages.length, 5));
  const sideImages = previewImages.slice(1);
  const hiddenPhotoCount = Math.max(galleryImages.length - 4, 0);

  return (
    <section className="border-t border-secondary-sand/70 pt-6 dark:border-zinc-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">Dokumentasi</h2>
        <span className="text-sm font-bold text-primary-charcoal/55 dark:text-gray-400">{galleryImages.length} foto</span>
      </div>

      <div className="grid gap-2 md:grid-cols-[1.25fr_1fr]">
        <button
          aria-label={`Buka foto 1 dari ${galleryImages.length}`}
            className="group relative min-h-[240px] overflow-hidden bg-secondary-sand/25 text-left dark:bg-zinc-800 md:min-h-[300px]"
          onClick={() => onOpenLightbox(0)}
          type="button"
        >
          <img
            alt={previewImages[0].altText || activityName}
            className="h-full min-h-[240px] w-full object-cover transition duration-500 group-hover:scale-[1.02] md:min-h-[300px]"
            src={previewImages[0].imageUrl}
          />
        </button>

        {sideImages.length ? (
          <div className="grid min-h-[220px] grid-cols-2 gap-2 md:min-h-[300px]">
            {sideImages.map((image, index) => {
              const photoIndex = index + 1;
              const showHiddenCount = photoIndex === 4 && hiddenPhotoCount > 0;

              return (
                <button
                  aria-label={`Buka foto ${photoIndex + 1} dari ${galleryImages.length}`}
                  className="group relative overflow-hidden bg-secondary-sand/25 text-left dark:bg-zinc-800"
                  key={image.id}
                  onClick={() => onOpenLightbox(photoIndex)}
                  type="button"
                >
                  <img
                    alt={image.altText || activityName}
                    className={cn("h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]", showHiddenCount ? "brightness-50" : "")}
                    src={image.imageUrl}
                  />
                  {showHiddenCount ? (
                    <span className="absolute inset-0 grid place-items-center bg-black/35 text-3xl font-black text-white">
                      +{hiddenPhotoCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <button
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-black text-primary-charcoal transition hover:bg-secondary-sand/25 dark:text-gray-100 dark:hover:bg-zinc-800"
        onClick={() => onOpenLightbox(0)}
        type="button"
      >
        Lihat semua foto
        <ExternalLink className="size-4" />
      </button>
    </section>
  );
}

function AboutActivitySection({ activity }: { activity: ActivityListItem }) {
  return (
    <section className="border-t border-secondary-sand/70 pt-6 dark:border-zinc-800">
      <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">Tentang Kegiatan</h2>
      <p className="mt-4 text-base leading-8 text-primary-charcoal/70 dark:text-gray-300">{activity.description}</p>
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold text-primary-charcoal/65 dark:text-gray-300">
        <span className="inline-flex items-center gap-2">
          <CalendarDays className="size-4" />
          {activity.displaySchedule}
        </span>
        <span className="inline-flex items-center gap-2">
          <MapPin className="size-4" />
          {activity.location}
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="size-4" />
          {activity.sportType}
        </span>
      </div>
    </section>
  );
}

function AdditionalInfoSection({ activity, authenticated }: { activity: ActivityListItem; authenticated: boolean }) {
  const participantCount = activity.participants?.length ?? 0;
  const visibleParticipants = activity.participants?.slice(0, 6) ?? [];
  const remainingParticipants = Math.max(0, participantCount - visibleParticipants.length);
  const showParticipants = authenticated && Boolean(activity.participants);

  if (!showParticipants && !(authenticated && activity.documentationUrl)) {
    return null;
  }

  return (
    <section className="border-t border-secondary-sand/70 pt-6 dark:border-zinc-800">
      <h2 className="font-poppins text-2xl font-black text-primary-charcoal dark:text-gray-100">Informasi Tambahan</h2>
      <div className="mt-5 grid gap-4">
        {showParticipants ? (
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-3 text-sm font-bold text-primary-charcoal/70 dark:text-gray-300">
              <Users className="size-4" />
              Peserta Terdaftar
            </span>
            <span className="text-sm font-black text-primary-charcoal dark:text-gray-100">
              {participantCount ? `${participantCount} orang` : "Belum ada"}
            </span>
          </div>
        ) : null}

        {showParticipants && visibleParticipants.length ? (
          <div className="flex flex-wrap gap-2">
            {visibleParticipants.map((participant) => (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-secondary-sand/70 bg-white px-3 py-1.5 text-xs font-bold dark:border-zinc-700 dark:bg-zinc-950"
                key={participant.athleteId}
              >
                <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-primary-green/15 text-[10px] text-primary-green">
                  {participant.profilePhotoUrl ? (
                    <img alt={`${participant.athleteName} profile`} className="h-full w-full object-cover" src={participant.profilePhotoUrl} />
                  ) : (
                    participant.athleteName[0]?.toUpperCase()
                  )}
                </span>
                {participant.athleteName}
              </span>
            ))}
            {remainingParticipants ? (
              <span className="inline-flex items-center rounded-full border border-secondary-sand/70 px-3 py-1.5 text-xs font-bold text-primary-charcoal/55 dark:border-zinc-700 dark:text-gray-400">
                +{remainingParticipants} lainnya
              </span>
            ) : null}
          </div>
        ) : null}

        {authenticated && activity.documentationUrl ? (
          <a
            className="flex items-center justify-between gap-4 rounded-xl border border-secondary-sand/70 px-4 py-3 text-sm font-black text-primary-brown transition hover:bg-secondary-sand/25 dark:border-zinc-800 dark:text-secondary-sand dark:hover:bg-zinc-800"
            href={activity.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="inline-flex items-center gap-3">
              <ExternalLink className="size-4" />
              Lihat dokumentasi
            </span>
            <ChevronRight className="size-4" />
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function ActivityLightbox({
  activePhotoIndex,
  activityName,
  closeLightbox,
  galleryImages,
  open,
  showNextPhoto,
  showPreviousPhoto,
}: {
  activePhotoIndex: number;
  activityName: string;
  closeLightbox: () => void;
  galleryImages: ActivityGalleryImage[];
  open: boolean;
  showNextPhoto: () => void;
  showPreviousPhoto: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(open, closeLightbox);
  const activeImage = galleryImages[activePhotoIndex];

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showNextPhoto();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showPreviousPhoto();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, showNextPhoto, showPreviousPhoto]);

  if (!open || !activeImage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] bg-black/90 p-4 backdrop-blur-sm md:p-8" onClick={closeLightbox}>
      <div
        aria-label={`Dokumentasi ${activityName}`}
        aria-modal="true"
        className="relative mx-auto flex h-full max-w-6xl flex-col outline-none"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="mb-4 flex items-center justify-between gap-3 text-white">
          <p className="font-bold text-white/80">{activePhotoIndex + 1} / {galleryImages.length}</p>
          <button
            aria-label="Tutup dokumentasi"
            className="grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={closeLightbox}
            type="button"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <img
            alt={activeImage.altText || activityName}
            className="h-full w-full object-contain"
            src={activeImage.imageUrl}
          />
          {galleryImages.length > 1 ? (
            <>
              <button
                aria-label="Foto sebelumnya"
                className="absolute left-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70 md:left-4"
                onClick={showPreviousPhoto}
                type="button"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                aria-label="Foto berikutnya"
                className="absolute right-2 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white transition hover:bg-black/70 md:right-4"
                onClick={showNextPhoto}
                type="button"
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ActivityDetailContent({
  activity,
  authenticated,
}: {
  activity: ActivityListItem | null;
  authenticated: boolean;
}) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const galleryImages = useMemo(() => [...(activity?.images ?? [])].sort((left, right) => left.sortOrder - right.sortOrder), [activity]);
  const safeActivePhotoIndex = galleryImages.length ? Math.min(activePhotoIndex, galleryImages.length - 1) : 0;
  const showDocumentation = authenticated && galleryImages.length > 0;
  const showAdditionalInfo = authenticated && (Boolean(activity?.participants) || Boolean(activity?.documentationUrl));

  if (!activity) {
    return null;
  }

  function openLightbox(index: number) {
    setActivePhotoIndex(Math.min(index, Math.max(galleryImages.length - 1, 0)));
    setLightboxOpen(true);
  }

  function closeLightbox() {
    setLightboxOpen(false);
  }

  function showNextPhoto() {
    if (!galleryImages.length) {
      return;
    }

    setActivePhotoIndex((current) => (Math.min(current, galleryImages.length - 1) + 1) % galleryImages.length);
  }

  function showPreviousPhoto() {
    if (!galleryImages.length) {
      return;
    }

    setActivePhotoIndex((current) => {
      const safeCurrent = Math.min(current, galleryImages.length - 1);
      return safeCurrent === 0 ? galleryImages.length - 1 : safeCurrent - 1;
    });
  }

  return (
    <article className="min-w-0">
      <ActivityHero
        activity={activity}
        authenticated={authenticated}
      />

      <div className={cn(
        "grid gap-10 px-4 py-12 sm:px-6 lg:px-8 xl:px-10 2xl:px-12",
        showDocumentation || showAdditionalInfo ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]" : "",
      )}>
        <div className="grid content-start gap-10">
          {showDocumentation ? (
            <DocumentationPreview
              activityName={activity.name}
              galleryImages={galleryImages}
              onOpenLightbox={openLightbox}
            />
          ) : null}
          <AboutActivitySection activity={activity} />
        </div>
        {showAdditionalInfo ? (
          <div className="grid content-start gap-10">
            <AdditionalInfoSection activity={activity} authenticated={authenticated} />
          </div>
        ) : null}
      </div>

      {showDocumentation ? (
        <ActivityLightbox
          activePhotoIndex={safeActivePhotoIndex}
          activityName={activity.name}
          closeLightbox={closeLightbox}
          galleryImages={galleryImages}
          open={lightboxOpen}
          showNextPhoto={showNextPhoto}
          showPreviousPhoto={showPreviousPhoto}
        />
      ) : null}
    </article>
  );
}
