import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import HomeActivitySections from "@/components/HomeActivitySections";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-primary-beige selection:bg-primary-brown selection:text-white" id="main-content">
      <Navbar />
      <Hero />
      <HomeActivitySections />
      <CTA />
      <Footer />
    </main>
  );
}
