import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { ActivityDetailPage } from "@/components/activities/ActivityDetailPage";

interface KegiatanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function KegiatanDetailPage({ params }: KegiatanDetailPageProps) {
  const { id } = await params;

  return (
    <div className="flex min-h-screen flex-col bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100">
      <Navbar topVariant="inverse" />
      <main className="flex-1" id="main-content">
        <ActivityDetailPage activityId={id} />
      </main>
      <Footer />
    </div>
  );
}
