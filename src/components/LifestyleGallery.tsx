"use client";

/* eslint-disable @next/next/no-img-element */

import { motion } from "framer-motion";
import { ImageIcon } from "lucide-react";
import type { HomeDocumentationCover } from "@/lib/activities/home-activity-content";

interface LifestyleGalleryProps {
  documentationCovers: HomeDocumentationCover[];
  error?: string | null;
  loading?: boolean;
}

const skeletonRatios = ["aspect-[4/3]", "aspect-square", "aspect-[4/3]", "aspect-[2/1]", "aspect-square"];

function skeletonRatio(index: number): string {
  return skeletonRatios[index % skeletonRatios.length];
}

function splitRows(items: HomeDocumentationCover[]): [HomeDocumentationCover[], HomeDocumentationCover[]] {
  const row1 = items.filter((_, index) => index % 2 === 0);
  const row2 = items.filter((_, index) => index % 2 === 1);

  return [row1.length ? row1 : items, row2.length ? row2 : row1];
}

function GalleryRow({ direction, items, rowKey }: { direction: "left" | "right"; items: HomeDocumentationCover[]; rowKey: string }) {
  const animation = direction === "left" ? { x: ["0%", "-50%"] } : { x: ["-50%", "0%"] };

  return (
    <div className="group relative flex w-full overflow-hidden">
      <motion.div
        animate={animation}
        className="flex w-max shrink-0 gap-4 sm:gap-6"
        transition={{ duration: 40, ease: "linear", repeat: Infinity }}
      >
        {[...items, ...items].map((item, index) => (
          <figure
            className="relative h-48 shrink-0 overflow-hidden rounded-2xl shadow-sm md:h-64 md:rounded-3xl"
            key={`${rowKey}-${item.id}-${index}`}
          >
            <img
              alt={item.altText}
              className="block h-full w-auto max-w-none"
              src={item.imageUrl}
            />
          </figure>
        ))}
      </motion.div>
    </div>
  );
}

function GallerySkeleton() {
  return (
    <div className="flex w-full origin-center -rotate-2 scale-105 flex-col gap-4 sm:gap-6">
      {[0, 1].map((row) => (
        <div className="flex w-full gap-4 overflow-hidden sm:gap-6" key={row}>
          {[0, 1, 2, 3, 4].map((item) => (
            <div
              className={`h-48 shrink-0 animate-pulse rounded-2xl bg-secondary-sand/30 dark:bg-zinc-800 md:h-64 md:rounded-3xl ${skeletonRatio(item + row)}`}
              key={item}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function LifestyleGallery({ documentationCovers, error = null, loading = false }: LifestyleGalleryProps) {
  const [row1, row2] = splitRows(documentationCovers);

  return (
    <section id="dokumentasi" className="overflow-hidden bg-white py-24 transition-colors duration-300 dark:bg-[#151515]">
      <div className="mb-16 w-full px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="text-center">
          <h2 className="mb-4 font-poppins text-3xl font-bold text-primary-charcoal dark:text-gray-100 md:text-4xl">
            Dokumentasi Kegiatan
          </h2>
          <p className="font-inter text-lg text-primary-charcoal/70 dark:text-gray-300">
            Potongan momen dari latihan, race day, dan kumpul sehat bareng komunitas.
          </p>
        </div>
      </div>

      {loading ? (
        <GallerySkeleton />
      ) : error ? (
        <div className="mx-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200 sm:mx-6 lg:mx-8">
          {error}
        </div>
      ) : documentationCovers.length ? (
        <div className="flex w-full origin-center -rotate-2 scale-105 flex-col gap-4 sm:gap-6">
          <GalleryRow direction="left" items={row1} rowKey="row1" />
          <GalleryRow direction="right" items={row2} rowKey="row2" />
        </div>
      ) : (
        <div className="mx-4 rounded-xl border border-secondary-sand/70 bg-white/75 px-5 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900 sm:mx-6 lg:mx-8">
          <ImageIcon className="mx-auto mb-4 size-8 text-primary-charcoal/35 dark:text-gray-500" />
          <h3 className="font-poppins text-xl font-black text-primary-charcoal dark:text-gray-100">Dokumentasi belum tersedia.</h3>
          <p className="mt-2 text-sm text-primary-charcoal/60 dark:text-gray-400">Dokumentasi baru akan muncul begitu momen serunya siap dibagikan.</p>
        </div>
      )}
    </section>
  );
}
