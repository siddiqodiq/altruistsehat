import Image from "next/image";
import logoImg from "../assets/logoputih.webp";

const Instagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
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
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    {...props}
  >
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-primary-charcoal text-white py-8 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        
        {/* Left Side: Logo & Copyright */}
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2">
            <div className="relative w-8 h-8 overflow-hidden">
              <Image src={logoImg} alt="Altruist Sehat Logo" fill className="object-contain" />
            </div>
            <span className="font-poppins font-medium text-lg text-primary-beige tracking-wide">
              Altruist Sehat
            </span>
          </div>
          <div className="hidden md:block w-px h-4 bg-white/20"></div>
          <p className="text-secondary-sand/50 font-inter text-xs">
            © {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
        
        {/* Right Side: Social & Links */}
        <div className="flex items-center gap-6">
          <div className="flex gap-4 text-xs text-secondary-sand/50">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
          <div className="w-px h-4 bg-white/20"></div>
          <div className="flex gap-4">
            <a href="https://www.instagram.com/altruistsehat/" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors hover:scale-110 transform">
              <Instagram className="w-4 h-4" />
            </a>
            <a href="https://strava.app.link/loGKYOA4U1b" target="_blank" rel="noopener noreferrer" className="text-white/60 hover:text-white transition-colors hover:scale-110 transform">
              <Strava className="w-4 h-4" />
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
