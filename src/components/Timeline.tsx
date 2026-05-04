"use client";

import { motion } from "framer-motion";

const timelineData = [
  // Event Bersama
  { title: "LINTAS TEKNOLOGI SOLUTION DAY 8th Edition", date: "29 November 2025", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "AMR Runs", date: "30 November 2025", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Topscore Fun Run 7K", date: "3 Desember 2025", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Jekate Running Series 2025", date: "4 Desember 2025", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Universal BPR Fun Run 5k", date: "10 Januari 2026", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "RS Puri Cinere Fun Run 5K", date: "25 Januari 2026", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Enervon Nusantara Run 5K", date: "8 Februari 2026", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Kolaboran 2025", date: "14 Februari 2026", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Rope&Run Challenge", date: "19 April 2026", type: "Event Bersama", color: "bg-primary-brown text-white" },
  { title: "Tring Golden Run", date: "26 April 2026", type: "Event Bersama", color: "bg-primary-brown text-white" },

  // Olahraga Rutin
  { title: "Lari bareng", date: "Setiap minggu", type: "Olahraga Rutin", color: "bg-secondary-teal text-primary-green" },
  { title: "Cisadon Trail", date: "Setiap Bulan", type: "Olahraga Rutin", color: "bg-secondary-teal text-primary-green" },
  { title: "Renang, Basket, Badminton, Sepakbola", date: "Rutin", type: "Olahraga Rutin", color: "bg-secondary-teal text-primary-green" },
  { title: "Tenis/padel", date: "Jarang", type: "Olahraga Rutin", color: "bg-secondary-teal text-primary-green" },
  { title: "Yoga", date: "Opsional", type: "Olahraga Rutin", color: "bg-secondary-teal text-primary-green" },

  // Coming Soon
  { title: "Bogor Run 2026", date: "Coming Soon", type: "Coming Soon", color: "bg-secondary-sand text-primary-charcoal" },
  { title: "ASNRun 2026", date: "Coming Soon", type: "Coming Soon", color: "bg-secondary-sand text-primary-charcoal" },
  { title: "Alfamart Run 2026", date: "Coming Soon", type: "Coming Soon", color: "bg-secondary-sand text-primary-charcoal" },
];

export default function Timeline() {
  return (
    <section className="py-24 bg-primary-beige dark:bg-[#121212] overflow-hidden border-t border-secondary-sand/20 dark:border-zinc-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-poppins font-bold text-primary-charcoal dark:text-gray-100 mb-4">
            Our Timeline Activity
          </h2>
          <p className="text-lg text-primary-charcoal/70 dark:text-gray-300 font-inter">
            Rangkaian kegiatan seru dan rutinitas olahraga komunitas kami.
          </p>
        </div>
      </div>

      <div className="relative flex overflow-hidden w-full group py-4">
        {/* Continuous background line for the whole section */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-secondary-sand/40 dark:bg-zinc-700 -translate-y-1/2 z-0 transition-colors"></div>

        <motion.div
          className="flex shrink-0 gap-4 md:gap-6 w-max items-center z-10"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 80, ease: "linear", repeat: Infinity }}
        >
          {[...timelineData, ...timelineData].map((item, index) => (
            <div
              key={`timeline-${index}`}
              className="relative w-56 md:w-80 h-[280px] md:h-[380px] shrink-0 group/card"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 md:w-6 md:h-6 rounded-full bg-primary-brown dark:bg-secondary-sand border-[3px] md:border-4 border-primary-beige dark:border-[#121212] z-20 group-hover/card:scale-125 transition-transform"></div>
              
              {/* Connection line dot to card */}
              <div className={`absolute left-1/2 -translate-x-1/2 w-px bg-secondary-sand/40 dark:bg-zinc-700 z-0 transition-colors ${index % 2 === 0 ? 'bottom-1/2 h-6 md:h-8' : 'top-1/2 h-6 md:h-8'}`}></div>

              {/* Card Container */}
              <div className={`absolute left-0 w-full px-1 md:px-2 ${index % 2 === 0 ? 'bottom-[calc(50%+1.5rem)] md:bottom-[calc(50%+2rem)]' : 'top-[calc(50%+1.5rem)] md:top-[calc(50%+2rem)]'}`}>
                <div className="bg-white dark:bg-zinc-800 p-4 md:p-6 rounded-xl md:rounded-2xl shadow-sm border border-secondary-sand/20 dark:border-zinc-700 group-hover/card:shadow-md transition-all group-hover/card:-translate-y-1">
                  <div className={`inline-block px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-semibold mb-2 md:mb-3 ${item.color}`}>
                    {item.type}
                  </div>
                  <h3 className="font-poppins font-bold text-primary-charcoal dark:text-gray-100 text-sm md:text-lg mb-1 md:mb-2 leading-snug">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-sm font-medium text-primary-charcoal/60 dark:text-gray-400">
                    <svg className="w-3 h-3 md:w-4 md:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="truncate">{item.date}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
