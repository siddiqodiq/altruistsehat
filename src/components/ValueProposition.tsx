"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion";
import type { HomeSportVisual } from "@/lib/activities/home-activity-content";

interface ValuePropositionProps {
  error?: string | null;
  loading?: boolean;
  sportVisuals: HomeSportVisual[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55 },
  },
};

function panelClipPath(index: number, total: number): string {
  const leftTop = index === 0 ? "0" : "24px";
  const rightBottom = index === total - 1 ? "100%" : "calc(100% - 24px)";

  return `polygon(${leftTop} 0, 100% 0, ${rightBottom} 100%, 0 100%)`;
}

function SportStripSkeleton() {
  return (
    <div className="overflow-hidden pb-3">
      <div className="flex h-[285px] min-w-max gap-1 px-4 sm:px-6 md:h-[305px] lg:h-[320px] lg:px-8 xl:w-full xl:min-w-0 xl:px-10 2xl:px-12">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div
            className="h-full min-w-[225px] shrink-0 animate-pulse bg-secondary-sand/40 dark:bg-zinc-800 sm:min-w-[260px] lg:min-w-[240px] xl:min-w-0 xl:flex-1"
            key={item}
            style={{ clipPath: panelClipPath(item, 6) }}
          />
        ))}
      </div>
    </div>
  );
}

export default function ValueProposition({ error = null, loading = false, sportVisuals }: ValuePropositionProps) {
  return (
    <section className="overflow-hidden bg-white py-20 transition-colors duration-300 dark:bg-[#121212] md:py-24" id="sports">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="mb-10 max-w-3xl text-left md:mb-12">
          <span className="mb-5 block h-3 w-8 border-l-2 border-t-2 border-primary-brown/60 dark:border-secondary-sand/60" aria-hidden="true" />
          <h2 className="mb-4 font-poppins text-4xl font-black tracking-normal text-primary-charcoal dark:text-gray-100 md:text-5xl">
            Olahraga Kami
          </h2>
          <p className="font-inter text-lg text-primary-charcoal/70 dark:text-gray-300">
            Beragam cara untuk bergerak bersama.
          </p>
        </div>
      </div>

      {loading ? (
        <SportStripSkeleton />
      ) : error ? (
        <div className="mx-4 border-l-2 border-red-400 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-200 sm:mx-6 lg:mx-8">
          {error}
        </div>
      ) : sportVisuals.length ? (
        <div className="overflow-x-auto pb-3">
          <motion.div
            variants={containerVariants}
            initial={false}
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="flex h-[285px] min-w-max gap-1 px-4 sm:px-6 md:h-[305px] lg:h-[320px] lg:px-8 xl:w-full xl:min-w-0 xl:px-10 2xl:px-12"
          >
            {sportVisuals.map((sportVisual, index) => (
              <motion.figure
                aria-label={sportVisual.sportType}
                className="group relative h-full min-w-[225px] shrink-0 overflow-hidden bg-primary-charcoal sm:min-w-[260px] lg:min-w-[240px] xl:min-w-0 xl:flex-1"
                key={sportVisual.sportType}
                style={{ clipPath: panelClipPath(index, sportVisuals.length) }}
                variants={itemVariants}
              >
                <div className="absolute inset-y-0 -left-8 -right-8 skew-x-6">
                  {sportVisual.imageUrl ? (
                    <img
                      alt={sportVisual.altText}
                      className="h-full w-full -skew-x-6 object-cover"
                      src={sportVisual.imageUrl}
                    />
                  ) : (
                    <div className="h-full w-full -skew-x-6 bg-[linear-gradient(135deg,#3b2417,#1f2937)]" />
                  )}
                  <div className="absolute inset-0 -skew-x-6 bg-gradient-to-t from-black/85 via-black/25 to-transparent transition-opacity duration-300 group-hover:from-black/75" />
                </div>
                <figcaption className="absolute bottom-7 left-6 right-5 z-10 text-white">
                  <p className="font-poppins text-xl font-black uppercase leading-tight tracking-normal [overflow-wrap:anywhere] md:text-2xl">
                    {sportVisual.sportType}
                  </p>
                  <span className="mt-4 block h-px w-10 bg-white/85" />
                </figcaption>
              </motion.figure>
            ))}
          </motion.div>
        </div>
      ) : (
        <div className="mx-4 border-y border-secondary-sand/70 px-5 py-12 text-left dark:border-zinc-800 sm:mx-6 lg:mx-8">
          <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Belum ada olahraga aktif.</h3>
          <p className="mt-2 text-sm text-primary-charcoal/60 dark:text-gray-400">Cabang olahraga akan muncul begitu agenda komunitas siap dibagikan.</p>
        </div>
      )}
    </section>
  );
}
