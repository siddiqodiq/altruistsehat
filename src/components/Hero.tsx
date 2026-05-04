"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { MapPin } from "lucide-react";
import logoImg from "../assets/LOGO.webp";
import logoPutih from "../assets/logoputih.webp";
import { useTheme } from "@/components/ThemeContext";

const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const Strava = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...props}
  >
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
  </svg>
);

export default function Hero() {
  const { theme } = useTheme();
  const currentLogo = theme === "dark" ? logoPutih : logoImg;

  return (
    <section className="relative pt-24 pb-20 lg:pt-28 lg:pb-32 overflow-hidden bg-gradient-to-b from-primary-beige to-secondary-sand/30 dark:from-[#121212] dark:to-zinc-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Text Content */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1 lg:col-span-6 space-y-8"
          >
            <div className="inline-block px-4 py-1.5 rounded-full bg-secondary-teal/10 dark:bg-secondary-teal/20 text-primary-green dark:text-secondary-teal font-medium text-sm mb-2 border border-secondary-teal/20 dark:border-secondary-teal/30">
              Komunitas Olahraga
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-poppins font-bold text-primary-charcoal dark:text-gray-100 leading-[1.15]">
              Sehat Hari Ini, <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-brown to-primary-green dark:from-secondary-sand dark:to-secondary-teal">Lebih Baik Nanti.</span>
            </h1>
            
            <p className="text-lg text-primary-charcoal/80 dark:text-gray-300 max-w-xl font-inter leading-relaxed">
              Platform komunitas olahraga bareng untuk hidup lebih berkualitas. Ayo olahraga bareng dan saling mengenal.
            </p>
            
            <div className="flex pt-4">
              <div className="bg-primary-brown text-white pl-8 pr-6 py-3.5 rounded-full font-medium shadow-lg flex items-center gap-4">
                <span>Join with us</span>
                <div className="flex items-center gap-3 border-l border-white/30 pl-4">
                  <a href="https://www.instagram.com/altruistsehat/" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors hover:scale-110 transform">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="https://strava.app.link/loGKYOA4U1b" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors hover:scale-110 transform">
                    <Strava className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Image Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="order-1 lg:order-2 lg:col-span-6 relative mb-16 sm:mb-12 lg:mb-0"
          >
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3] lg:aspect-square flex items-center justify-center p-8">
              <Image 
                src={currentLogo} 
                alt="Altruist Sehat Logo" 
                fill
                className="object-contain p-8 drop-shadow-2xl"
                priority
              />
            </div>
            
            {/* Floating Elements Container */}
            <div className="absolute -bottom-8 sm:-bottom-6 left-1/2 -translate-x-1/2 w-max flex flex-row items-center justify-center gap-2 sm:gap-4 z-10">
              {/* Floating Element 1: Anggota Aktif */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                className="bg-white/95 sm:bg-white dark:bg-zinc-800/95 dark:sm:bg-zinc-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-secondary-sand/30 dark:border-zinc-700 backdrop-blur-sm w-auto transition-colors"
              >
                <div className="flex items-center justify-start gap-2 sm:gap-4">
                  <div className="bg-secondary-teal/20 dark:bg-secondary-teal/10 w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-primary-green dark:text-secondary-teal font-bold text-sm sm:text-xl">✓</span>
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] sm:text-xs text-primary-charcoal/60 dark:text-gray-400 font-medium">Anggota Aktif</p>
                    <p className="text-sm sm:text-lg font-poppins font-bold text-primary-charcoal dark:text-gray-100 leading-none mt-0.5">90+</p>
                  </div>
                </div>
              </motion.div>

              {/* Floating Element 2: Lokasi Area */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4, delay: 1, ease: "easeInOut" }}
                className="bg-white/95 sm:bg-white dark:bg-zinc-800/95 dark:sm:bg-zinc-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-xl border border-secondary-sand/30 dark:border-zinc-700 backdrop-blur-sm w-auto transition-colors"
              >
                <div className="flex items-center justify-start gap-2 sm:gap-4">
                  <div className="bg-primary-brown/10 dark:bg-secondary-sand/10 w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 text-primary-brown dark:text-secondary-sand">
                    <MapPin className="w-4 h-4 sm:w-6 sm:h-6" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] sm:text-xs text-primary-charcoal/60 dark:text-gray-400 font-medium">Lokasi Area</p>
                    <p className="text-sm sm:text-lg font-poppins font-bold text-primary-charcoal dark:text-gray-100 leading-none mt-0.5">Jabodetabek</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
      
      {/* Background Decor */}
      <div className="absolute top-1/2 left-0 w-64 h-64 bg-secondary-teal/20 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2"></div>
      <div className="absolute top-20 right-0 w-96 h-96 bg-primary-brown/10 rounded-full blur-3xl translate-x-1/3"></div>
    </section>
  );
}
