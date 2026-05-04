"use client";

import { motion } from "framer-motion";
import { Users, Swords, Handshake, Megaphone } from "lucide-react";

const features = [
  {
    title: "Olahraga Bareng",
    description: "Bergabung bersama anggota komunitas lainnya untuk sesi olahraga rutin yang seru.",
    icon: <Users className="w-6 h-6 text-primary-brown" />,
    color: "bg-secondary-sand/30",
  },
  {
    title: "Sparing Olahraga",
    description: "Ajang pertandingan persahabatan antar anggota atau komunitas untuk melatih kemampuan.",
    icon: <Swords className="w-6 h-6 text-primary-green" />,
    color: "bg-secondary-teal/20",
  },
  {
    title: "Partnership Event",
    description: "Acara-acara spesial yang diselenggarakan bersama mitra kesehatan dan olahraga.",
    icon: <Handshake className="w-6 h-6 text-secondary-clay" />,
    color: "bg-secondary-clay/20",
  },
  {
    title: "Brand Collaboration",
    description: "Kesempatan bekerja sama dengan berbagai brand terkemuka di industri gaya hidup.",
    icon: <Megaphone className="w-6 h-6 text-secondary-sky" />,
    color: "bg-secondary-sky/30",
  },
];

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

export default function Features() {
  return (
    <section id="program" className="py-24 bg-primary-beige/30 dark:bg-[#181818] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl md:text-4xl font-poppins font-bold text-primary-charcoal dark:text-gray-100 mb-4">
              Kegiatan Kami
            </h2>
            <p className="text-lg text-primary-charcoal/70 dark:text-gray-300 font-inter">
              Berbagai aktivitas seru yang kami selenggarakan untuk membangun komunitas yang aktif dan suportif.
            </p>
          </div>
          <a href="#dokumentasi" className="text-primary-brown dark:text-secondary-sand font-medium hover:text-primary-brown/80 dark:hover:text-secondary-sand/80 transition-colors flex items-center gap-2">
            Lihat semua kegiatan
            <span>→</span>
          </a>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              whileHover={{ y: -8, transition: { duration: 0.2 } }}
              className="bg-white dark:bg-zinc-800/80 rounded-xl md:rounded-2xl p-4 sm:p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] dark:hover:shadow-xl dark:hover:bg-zinc-700/80 transition-all duration-300 border border-secondary-sand/20 dark:border-zinc-700 flex flex-col"
            >
              <div className={`w-10 h-10 md:w-14 md:h-14 rounded-lg md:rounded-xl ${feature.color} flex items-center justify-center mb-3 md:mb-6 shrink-0`}>
                <div className="scale-75 md:scale-100 flex items-center justify-center">
                  {feature.icon}
                </div>
              </div>
              <h3 className="text-sm sm:text-base md:text-xl font-poppins font-semibold text-primary-charcoal dark:text-gray-100 mb-2 md:mb-3 leading-tight">
                {feature.title}
              </h3>
              <p className="text-[11px] sm:text-xs md:text-sm text-primary-charcoal/60 dark:text-gray-400 font-inter leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
