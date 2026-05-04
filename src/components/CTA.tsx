"use client";

import { motion } from "framer-motion";

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

export default function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background with Earth Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-brown to-[#3E1D0E] z-0"></div>
      
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary-clay/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 z-0"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-secondary-sand/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 z-0"></div>

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
          <p className="text-xl text-secondary-sand/90 font-inter mb-10 max-w-2xl mx-auto">
            Bergabunglah dengan ribuan orang lainnya yang telah memulai perjalanan menuju hidup yang lebih bermakna dan sehat.
          </p>
          <div className="flex justify-center">
            <div className="bg-primary-beige text-primary-brown pl-10 pr-8 py-4 rounded-full font-semibold text-lg shadow-[0_0_40px_rgb(245,241,235,0.2)] flex items-center gap-5 transition-all">
              <span>Join Komunitas</span>
              <div className="flex items-center gap-3 border-l border-primary-brown/20 pl-5">
                <a href="https://www.instagram.com/altruistsehat/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-brown/70 transition-colors hover:scale-110 transform">
                  <Instagram className="w-6 h-6" />
                </a>
                <a href="https://strava.app.link/loGKYOA4U1b" target="_blank" rel="noopener noreferrer" className="hover:text-primary-brown/70 transition-colors hover:scale-110 transform">
                  <Strava className="w-6 h-6" />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
