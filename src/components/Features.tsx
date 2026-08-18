"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion";
import { CalendarDays, ImageIcon } from "lucide-react";
import Link from "next/link";
import type { ActivityListItem } from "@/lib/activities/api";
import { homeFeaturedActivities } from "@/lib/activities/home-activity-content";
import { ActivityLogoTitle } from "@/components/activities/ActivityLogoTitle";

interface FeaturesProps {
  activities: ActivityListItem[];
  error?: string | null;
  loading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

function ActivityImage({ activity }: { activity: ActivityListItem }) {
  const imageUrl = activity.coverImageUrl ?? activity.images[0]?.imageUrl;

  return (
    <div className="mb-4 aspect-[4/3] overflow-hidden rounded-lg bg-secondary-sand/25 dark:bg-zinc-900">
      {imageUrl ? (
        <img alt={`${activity.name} cover`} className="h-full w-full object-cover" src={imageUrl} />
      ) : (
        <div className="grid h-full w-full place-items-center text-primary-charcoal/40 dark:text-gray-500">
          <ImageIcon className="size-7" />
        </div>
      )}
    </div>
  );
}

export default function Features({ activities, error = null, loading = false }: FeaturesProps) {
  const featuredActivities = homeFeaturedActivities(activities);

  return (
    <section id="program" className="bg-primary-beige/30 py-24 transition-colors duration-300 dark:bg-[#181818]">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mb-16 flex flex-col items-end justify-between gap-6 md:flex-row">
          <div className="w-full">
            <h2 className="mb-4 font-poppins text-3xl font-bold text-primary-charcoal dark:text-gray-100 md:text-4xl">
              Kegiatan Kami
            </h2>
            <p className="font-inter text-lg text-primary-charcoal/70 dark:text-gray-300">
              Agenda terbaru komunitas untuk bergerak, bertemu, dan pulang dengan cerita baru.
            </p>
          </div>
          <Link href="/event" className="flex items-center gap-2 font-medium text-primary-brown transition-colors hover:text-primary-brown/80 dark:text-secondary-sand dark:hover:text-secondary-sand/80">
            Lihat semua kegiatan
            <span>→</span>
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 md:gap-6">
            {[0, 1, 2, 3].map((item) => (
              <div className="h-64 animate-pulse rounded-xl border border-secondary-sand/30 bg-white/65 dark:border-zinc-800 dark:bg-zinc-900" key={item} />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : featuredActivities.length ? (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 md:gap-6"
          >
            {featuredActivities.map((activity) => (
              <Link
                href={`/kegiatan/${activity.id}`}
                key={activity.id}
                className="block"
              >
                <motion.div
                  variants={cardVariants}
                  whileHover={{ y: -8, transition: { duration: 0.2 } }}
                  className="flex h-full flex-col rounded-xl border border-secondary-sand/20 bg-white p-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:border-zinc-700 dark:bg-zinc-800/80 dark:shadow-none dark:hover:bg-zinc-700/80 dark:hover:shadow-xl"
                >
                  <ActivityImage activity={activity} />
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary-brown/10 px-2.5 py-1 text-[11px] font-black text-primary-brown dark:bg-secondary-sand/10 dark:text-secondary-sand">
                      {activity.activityType}
                    </span>
                    <span className="rounded-full bg-primary-green/10 px-2.5 py-1 text-[11px] font-black text-primary-green">
                      {activity.sportType}
                    </span>
                  </div>
                  <ActivityLogoTitle
                    activity={activity}
                    as="h3"
                    className="mb-2"
                    fallbackClassName="font-poppins text-base font-semibold leading-tight text-primary-charcoal dark:text-gray-100 md:text-lg"
                    logoClassName="max-h-12"
                  />
                  <p className="mb-3 flex items-center gap-2 text-xs font-bold text-primary-charcoal/55 dark:text-gray-400">
                    <CalendarDays className="size-4 shrink-0" />
                    <span>{activity.displaySchedule}</span>
                  </p>
                  <p className="line-clamp-3 text-sm leading-6 text-primary-charcoal/60 dark:text-gray-400">
                    {activity.description}
                  </p>
                </motion.div>
              </Link>
            ))}
          </motion.div>
        ) : (
          <div className="rounded-xl border border-secondary-sand/70 bg-white/75 px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Belum ada kegiatan.</h3>
            <p className="mt-2 text-sm text-primary-charcoal/60 dark:text-gray-400">Agenda baru akan muncul di sini begitu siap dibagikan.</p>
          </div>
        )}
      </div>
    </section>
  );
}
