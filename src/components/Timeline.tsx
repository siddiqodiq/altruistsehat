"use client";

import { motion } from "framer-motion";
import { CalendarDays, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ActivityListItem } from "@/lib/activities/api";
import { homeTimelineActivities } from "@/lib/activities/home-activity-content";
import { ACTIVITY_TYPES } from "@/lib/activities/schema";
import { ActivityLogoTitle } from "@/components/activities/ActivityLogoTitle";
import { cn } from "@/lib/utils";

interface TimelineProps {
  activities: ActivityListItem[];
  error?: string | null;
  loading?: boolean;
}

function timelineColor(activityType: string) {
  const index = ACTIVITY_TYPES.findIndex((item) => item === activityType);
  return [
    "bg-primary-brown dark:bg-[#2A2A2A] text-white",
    "bg-secondary-teal text-primary-green",
    "bg-secondary-sand text-primary-charcoal",
  ][Math.max(index, 0)];
}

export default function Timeline({ activities, error = null, loading = false }: TimelineProps) {
  const timelineItems = homeTimelineActivities(activities);
  const repeatedItems = timelineItems.length > 4 ? [...timelineItems, ...timelineItems] : timelineItems;

  return (
    <section className="overflow-hidden border-t border-secondary-sand/20 bg-primary-beige py-24 transition-colors duration-300 dark:border-zinc-800 dark:bg-[#121212]">
      <div className="mb-16 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="text-center">
          <h2 className="mb-4 font-poppins text-3xl font-bold text-primary-charcoal dark:text-gray-100 md:text-4xl">
            Cerita Kegiatan
          </h2>
          <p className="font-inter text-lg text-primary-charcoal/70 dark:text-gray-300">
            Rangkaian agenda komunitas, dari latihan rutin sampai momen finish yang layak dikenang.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary-brown" />
        </div>
      ) : error ? (
        <div className="mx-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:mx-6 lg:mx-8">
          {error}
        </div>
      ) : timelineItems.length ? (
        <div className="group relative flex w-full overflow-hidden py-4">
          <div className="absolute left-0 top-1/2 z-0 h-1 w-full -translate-y-1/2 bg-secondary-sand/40 transition-colors dark:bg-zinc-700" />

          <motion.div
            className="z-10 flex w-max shrink-0 items-center gap-4 md:gap-6"
            animate={timelineItems.length > 4 ? { x: ["0%", "-50%"] } : undefined}
            transition={timelineItems.length > 4 ? { duration: 80, ease: "linear", repeat: Infinity } : undefined}
          >
            {repeatedItems.map((item, index) => (
              <Link
                className="group/card relative h-[280px] w-56 shrink-0 md:h-[380px] md:w-80"
                href={`/kegiatan/${item.id}`}
                key={`timeline-${item.id}-${index}`}
              >
                <div className="absolute left-1/2 top-1/2 z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-primary-beige bg-primary-brown transition-transform group-hover/card:scale-125 dark:border-[#121212] dark:bg-secondary-sand md:size-6 md:border-4" />

                <div className={cn("absolute left-1/2 z-0 w-px -translate-x-1/2 bg-secondary-sand/40 transition-colors dark:bg-zinc-700", index % 2 === 0 ? "bottom-1/2 h-6 md:h-8" : "top-1/2 h-6 md:h-8")} />

                <div className={cn("absolute left-0 w-full px-1 md:px-2", index % 2 === 0 ? "bottom-[calc(50%+1.5rem)] md:bottom-[calc(50%+2rem)]" : "top-[calc(50%+1.5rem)] md:top-[calc(50%+2rem)]")}>
                  <div className="rounded-xl border border-secondary-sand/20 bg-white p-4 shadow-sm transition-all group-hover/card:-translate-y-1 group-hover/card:shadow-md dark:border-zinc-700 dark:bg-zinc-800 md:p-6">
                    <div className={cn("mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold md:mb-3 md:px-3 md:py-1 md:text-xs", timelineColor(item.activityType))}>
                      {item.activityType}
                    </div>
                    <ActivityLogoTitle
                      activity={item}
                      as="h3"
                      className="mb-1 md:mb-2"
                      fallbackClassName="font-poppins text-sm font-bold leading-snug text-primary-charcoal dark:text-gray-100 md:text-lg"
                      logoClassName="max-h-10"
                    />
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary-charcoal/60 dark:text-gray-400 md:gap-2 md:text-sm">
                      <CalendarDays className="size-3 shrink-0 md:size-4" />
                      <span className="truncate">{item.displaySchedule}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </motion.div>
        </div>
      ) : (
        <div className="mx-4 rounded-xl border border-secondary-sand/70 bg-white/75 px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:mx-6 lg:mx-8">
          <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Timeline belum tersedia.</h3>
        </div>
      )}
    </section>
  );
}
