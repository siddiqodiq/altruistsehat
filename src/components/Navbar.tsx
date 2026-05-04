"use client";

import { useState } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
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

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const navLinks = [
    { name: "Beranda", href: "#" },
    { name: "Kegiatan", href: "#program" },
  ];

  const currentLogo = theme === "dark" ? logoPutih : logoImg;

  return (
    <nav className="fixed w-full z-50 bg-primary-beige/90 dark:bg-[#121212]/90 backdrop-blur-md border-b border-secondary-sand/50 dark:border-zinc-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex items-center gap-2">
            <div className="relative w-10 h-10 overflow-hidden rounded-lg">
              <Image src={currentLogo} alt="Altruist Sehat" fill className="object-contain" />
            </div>
            <span className="font-poppins font-semibold text-xl text-primary-charcoal dark:text-gray-100">
              Altruist Sehat
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="text-primary-charcoal dark:text-gray-300 hover:text-primary-brown dark:hover:text-secondary-sand font-medium transition-colors"
              >
                {link.name}
              </a>
            ))}
            
            <button
              onClick={toggleTheme}
              className="relative flex items-center w-[60px] h-8 bg-[#f4f6f9] dark:bg-[#0f111a] rounded-full p-1 transition-colors duration-300 shadow-inner"
              aria-label="Toggle Dark Mode"
            >
              <div 
                className={`absolute w-6 h-6 rounded-full transition-all duration-300 ease-in-out ${
                  theme === "dark" ? "translate-x-[28px] bg-[#2d324f]" : "translate-x-0 bg-[#e2e8f0]"
                }`}
              />
              <div className="relative flex justify-between w-full px-[3px] z-10 pointer-events-none">
                <Sun className={`w-[18px] h-[18px] transition-colors duration-300 ${theme === "dark" ? "text-slate-500" : "text-slate-800"}`} />
                <Moon className={`w-[18px] h-[18px] transition-colors duration-300 ${theme === "dark" ? "text-white" : "text-slate-400"}`} />
              </div>
            </button>

            <div className="bg-primary-brown dark:bg-[#2A2A2A] text-white pl-6 pr-4 py-2 rounded-full shadow-sm flex items-center gap-3">
              <span className="text-sm font-medium">Join us</span>
              <div className="flex items-center gap-2 border-l border-white/30 pl-3">
                <a href="https://www.instagram.com/altruistsehat/" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors hover:scale-110 transform">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://strava.app.link/loGKYOA4U1b" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors hover:scale-110 transform">
                  <Strava className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="relative flex items-center w-[60px] h-8 bg-[#f4f6f9] dark:bg-[#0f111a] rounded-full p-1 transition-colors duration-300 shadow-inner"
              aria-label="Toggle Dark Mode"
            >
              <div 
                className={`absolute w-6 h-6 rounded-full transition-all duration-300 ease-in-out ${
                  theme === "dark" ? "translate-x-[28px] bg-[#2d324f]" : "translate-x-0 bg-[#e2e8f0]"
                }`}
              />
              <div className="relative flex justify-between w-full px-[3px] z-10 pointer-events-none">
                <Sun className={`w-[18px] h-[18px] transition-colors duration-300 ${theme === "dark" ? "text-slate-500" : "text-slate-800"}`} />
                <Moon className={`w-[18px] h-[18px] transition-colors duration-300 ${theme === "dark" ? "text-white" : "text-slate-400"}`} />
              </div>
            </button>
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-primary-charcoal dark:text-gray-300 hover:text-primary-brown dark:hover:text-secondary-sand focus:outline-none"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-primary-beige dark:bg-[#121212] border-b border-secondary-sand/50 dark:border-zinc-800"
        >
          <div className="px-4 pt-2 pb-6 space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="block px-3 py-2 text-base font-medium text-primary-charcoal dark:text-gray-300 hover:text-primary-brown dark:hover:text-secondary-sand hover:bg-secondary-sand/30 dark:hover:bg-zinc-800 rounded-md"
              >
                {link.name}
              </a>
            ))}
            <div className="w-full mt-4 bg-primary-brown dark:bg-[#2A2A2A] text-white px-6 py-3 rounded-full font-medium flex justify-between items-center">
              <span>Join us</span>
              <div className="flex items-center gap-3 border-l border-white/30 pl-4">
                <a href="https://www.instagram.com/altruistsehat/" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://strava.app.link/loGKYOA4U1b" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">
                  <Strava className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </nav>
  );
}
