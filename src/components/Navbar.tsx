import { redirect } from "next/navigation";
import { NavbarClient, type NavbarProfile } from "@/components/NavbarClient";
import {
  createSupabaseServerAuthClient,
  getCurrentAuthProfile,
  isSupabaseAuthConfigError,
} from "@/lib/supabase/auth-server";

interface NavbarProps {
  topVariant?: "default" | "inverse";
}

function navbarProfileFromAuth(profile: Awaited<ReturnType<typeof getCurrentAuthProfile>>): NavbarProfile | null {
  if (!profile) {
    return null;
  }

  return {
    athleteId: profile.athlete?.id,
    name: profile.athlete?.name ?? "Akun Altruist",
    profilePhotoUrl: profile.athlete?.profilePhotoUrl,
    role: profile.role,
    username: profile.athlete?.username,
  };
}

export default async function Navbar({ topVariant = "default" }: NavbarProps = {}) {
  const profile = navbarProfileFromAuth(await getCurrentAuthProfile());

  async function logoutAction() {
    "use server";

    try {
      const supabase = await createSupabaseServerAuthClient();
      await supabase.auth.signOut();
    } catch (error) {
      if (!isSupabaseAuthConfigError(error)) {
        throw error;
      }
    }

    redirect("/");
  }

  return <NavbarClient logoutAction={logoutAction} profile={profile} topVariant={topVariant} />;
}
