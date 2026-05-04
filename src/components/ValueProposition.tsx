"use client";

import { motion } from "framer-motion";
import { Waves, Bike, Plus, SportShoe } from "lucide-react";

const BadmintonIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 18v4"/>
    <path d="M12 14c-2 0-3 1.5-3 4h6c0-2.5-1-4-3-4z"/>
    <path d="m9.5 14-4.5-9"/>
    <path d="m14.5 14 4.5-9"/>
    <path d="m12 14-1-10"/>
    <path d="m12 14 1-10"/>
    <path d="M7 8h10"/>
    <path d="M8.5 11h7"/>
  </svg>
);

const SoccerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"/>
    <path d="m12 7-3.5 2.5L9 14h6l.5-4.5z"/>
    <path d="M12 7V2"/>
    <path d="m8.5 9.5-4-3"/>
    <path d="m15.5 9.5 4-3"/>
    <path d="m9 14-4 4"/>
    <path d="m15 14 4 4"/>
  </svg>
);

const values = [
  {
    title: "Lari",
    description: "Tingkatkan stamina dan kebugaran dengan komunitas lari yang suportif.",
    icon: <SportShoe className="w-8 h-8 text-primary-brown" strokeWidth={1.5} />,
  },
  {
    title: "Renang / Diving",
    description: "Jelajahi keindahan bawah air dan optimalkan kesehatan kardiovaskular Anda.",
    icon: <Waves className="w-8 h-8 text-primary-green" strokeWidth={1.5} />,
  },
  {
    title: "Bulu Tangkis",
    description: "Latih ketangkasan, refleks, dan nikmati permainan seru bersama pemain lain.",
    icon: <BadmintonIcon className="w-8 h-8 text-secondary-clay" />,
  },
  {
    title: "Sepakbola / Mini Soccer / Futsal",
    description: "Membangun kerja sama tim, taktik, dan kompetisi sehat di lapangan hijau.",
    icon: <SoccerIcon className="w-8 h-8 text-primary-brown" />,
  },
  {
    title: "Sepeda",
    description: "Nikmati perjalanan jauh, pacu adrenalin, dan berpetualang bersama pesepeda lain.",
    icon: <Bike className="w-8 h-8 text-primary-green" strokeWidth={1.5} />,
  },
  {
    title: "And Others",
    description: "Olahraga lainnya, yang penting ada orangnya. Gas kita mainkan",
    icon: <Plus className="w-8 h-8 text-secondary-clay" strokeWidth={1.5} />,
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6 },
  },
};

export default function ValueProposition() {
  return (
    <section className="py-24 bg-white dark:bg-[#121212] transition-colors duration-300" id="sports">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16 max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-primary-charcoal dark:text-gray-100 mb-4">
            Olahraga Kami
          </h2>
          <p className="text-lg text-primary-charcoal/70 dark:text-gray-300 font-inter">
            Ayo olahraga bareng supaya sehat, berikut olahraga yang sering kami lakukan
          </p>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-10 md:gap-12"
        >
          {values.map((value, index) => (
            <motion.div 
              key={index} 
              variants={itemVariants}
              className="flex flex-col items-center text-center group"
            >
              <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl bg-secondary-sand/20 dark:bg-zinc-800/80 flex items-center justify-center mb-4 md:mb-6 group-hover:bg-secondary-sand/40 dark:group-hover:bg-zinc-700 transition-colors duration-300">
                <div className="scale-75 md:scale-100 flex items-center justify-center">
                  {value.icon}
                </div>
              </div>
              <h3 className="text-sm sm:text-base md:text-xl font-poppins font-semibold text-primary-charcoal dark:text-gray-100 mb-2 md:mb-3">
                {value.title}
              </h3>
              <p className="text-[11px] sm:text-xs md:text-base text-primary-charcoal/70 dark:text-gray-400 font-inter leading-relaxed">
                {value.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
