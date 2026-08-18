import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { ProfilePageClient } from "@/components/profile/ProfilePageClient";
import { getCurrentAuthProfile } from "@/lib/supabase/auth-server";

export default async function ProfilPage() {
  const profile = await getCurrentAuthProfile();

  if (!profile) {
    redirect(`/auth/login?next=${encodeURIComponent("/profil")}`);
  }

  return (
    <>
      <Navbar />
      <main id="main-content">
        <ProfilePageClient initialRole={profile.role} />
      </main>
    </>
  );
}
