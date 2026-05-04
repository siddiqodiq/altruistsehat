import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ValueProposition from "@/components/ValueProposition";
import Features from "@/components/Features";
import LifestyleGallery from "@/components/LifestyleGallery";
import Timeline from "@/components/Timeline";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-primary-beige selection:bg-primary-brown selection:text-white">
      <Navbar />
      <Hero />
      <ValueProposition />
      <Features />
      <LifestyleGallery />
      <Timeline />
      <CTA />
      <Footer />
    </main>
  );
}
