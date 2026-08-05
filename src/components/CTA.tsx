"use client";

import { motion } from "framer-motion";
import { Instagram, Strava } from "@/components/icons/SocialIcons";

export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background with Earth Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-brown to-[#3E1D0E] dark:from-[#1F1F1F] dark:to-[#121212] z-0"></div>
      
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary-clay/10 dark:bg-white/5 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 z-0"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary-sand/10 dark:bg-white/5 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 z-0"></div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-poppins font-bold text-white mb-6 leading-tight">
            Investasi Terbaik <br className="hidden md:block" /> Adalah Kesehatan Anda.
          </h2>
          <p className="text-xl text-secondary-sand/90 dark:text-gray-300 font-inter mb-10 max-w-2xl mx-auto">
            Bergabunglah dengan ribuan orang lainnya yang telah memulai perjalanan menuju hidup yang lebih bermakna dan sehat.
          </p>
          <div className="flex justify-center">
            <div className="bg-primary-beige dark:bg-[#2A2A2A] text-primary-brown dark:text-white pl-6 pr-5 py-3 sm:pl-10 sm:pr-8 sm:py-4 rounded-full font-semibold text-base sm:text-lg shadow-[0_0_40px_rgb(245,241,235,0.2)] dark:shadow-[0_0_40px_rgb(255,255,255,0.05)] flex items-center gap-3 sm:gap-5 transition-all">
              <span>Join Komunitas</span>
              <div className="flex items-center gap-2 sm:gap-3 border-l border-primary-brown/20 dark:border-white/20 pl-4 sm:pl-5">
                <a href="https://www.instagram.com/altruistsehat/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-brown/70 dark:hover:text-gray-300 transition-colors hover:scale-110 transform">
                  <Instagram className="w-5 h-5 sm:w-6 sm:h-6" />
                </a>
                <a href="https://strava.app.link/loGKYOA4U1b" target="_blank" rel="noopener noreferrer" className="hover:text-primary-brown/70 dark:hover:text-gray-300 transition-colors hover:scale-110 transform">
                  <Strava className="w-5 h-5 sm:w-6 sm:h-6" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
