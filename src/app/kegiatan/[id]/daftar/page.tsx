import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { ActivityRegistrationPage } from "@/components/activities/ActivityRegistrationPage";

interface KegiatanRegistrationPageProps {
  params: Promise<{ id: string }>;
}

export default async function KegiatanRegistrationPage({ params }: KegiatanRegistrationPageProps) {
  const { id } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <Navbar />
      <main className="flex-1" id="main-content">
        <ActivityRegistrationPage activityId={id} />
      </main>
      <Footer />
    </div>
  );
}
