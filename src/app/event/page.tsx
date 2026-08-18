import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { ActivitiesPage } from "@/components/activities/ActivitiesPage";

export default function EventPage() {
  return (
    <div className="flex min-h-screen flex-col bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <Navbar />
      <main className="flex-1" id="main-content">
        <ActivitiesPage mode="events" />
      </main>
      <Footer />
    </div>
  );
}
