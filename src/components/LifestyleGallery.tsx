"use client";

import { motion } from "framer-motion";
import Image from "next/image";

import img1 from "../assets/kolase/image-1.webp";
import img2 from "../assets/kolase/image-2.webp";
import img3 from "../assets/kolase/image-3.webp";
import img4 from "../assets/kolase/image-4.webp";
import img5 from "../assets/kolase/image-5.webp";
import img6 from "../assets/kolase/image-6.webp";
import img7 from "../assets/kolase/image-7.webp";
import img8 from "../assets/kolase/image-8.webp";
import img9 from "../assets/kolase/image-9.webp";
import img10 from "../assets/kolase/image-10.webp";
import img11 from "../assets/kolase/image-11.webp";
import img12 from "../assets/kolase/image-12.webp";
import img13 from "../assets/kolase/image-13.webp";
import img14 from "../assets/kolase/image-14.webp";
import img15 from "../assets/kolase/C5D_5100.webp";

const row1 = [
  { src: img1, ratio: "aspect-[4/3]" },
  { src: img2, ratio: "aspect-square" },
  { src: img3, ratio: "aspect-[4/3]" },
  { src: img4, ratio: "aspect-[2/1]" },
  { src: img5, ratio: "aspect-square" },
  { src: img6, ratio: "aspect-[4/3]" },
  { src: img7, ratio: "aspect-square" },
  { src: img15, ratio: "aspect-[4/3]" },
];

const row2 = [
  { src: img8, ratio: "aspect-[2/1]" },
  { src: img9, ratio: "aspect-square" },
  { src: img10, ratio: "aspect-[4/3]" },
  { src: img11, ratio: "aspect-square" },
  { src: img12, ratio: "aspect-[4/3]" },
  { src: img13, ratio: "aspect-[2/1]" },
  { src: img14, ratio: "aspect-[4/3]" },
];

export default function LifestyleGallery() {
  return (
    <section id="dokumentasi" className="py-24 bg-white dark:bg-[#151515] overflow-hidden transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-primary-charcoal dark:text-gray-100 mb-4">
            Dokumentasi Kegiatan
          </h2>
          <p className="text-lg text-primary-charcoal/70 dark:text-gray-300 font-inter">
            kegiatan seru kami gini lohhh
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:gap-6 w-full -rotate-2 scale-105 origin-center">
        {/* Row 1 - Moves Left */}
        <div className="relative flex overflow-hidden w-full group">
          <motion.div
            className="flex shrink-0 gap-4 sm:gap-6 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 40, ease: "linear", repeat: Infinity }}
          >
            {[...row1, ...row1].map((item, index) => (
              <div
                key={`row1-${index}`}
                className={`relative h-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden shrink-0 shadow-sm ${item.ratio}`}
              >
                <Image
                  src={item.src}
                  alt="Dokumentasi Kegiatan"
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-110"
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Row 2 - Moves Right */}
        <div className="relative flex overflow-hidden w-full group">
          <motion.div
            className="flex shrink-0 gap-4 sm:gap-6 w-max"
            animate={{ x: ["-50%", "0%"] }}
            transition={{ duration: 40, ease: "linear", repeat: Infinity }}
          >
            {[...row2, ...row2].map((item, index) => (
              <div
                key={`row2-${index}`}
                className={`relative h-48 md:h-64 rounded-2xl md:rounded-3xl overflow-hidden shrink-0 shadow-sm ${item.ratio}`}
              >
                <Image
                  src={item.src}
                  alt="Dokumentasi Kegiatan"
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-110"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
