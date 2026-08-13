import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AdminHub } from "@/components/admin/AdminHub";
import Navbar from "@/components/Navbar";
import { getCurrentAuthRole } from "@/lib/supabase/auth-server";

interface AdminPageProps {
  searchParams?: Promise<{
    tab?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const params = (await searchParams) ?? {};
  const tab = firstParam(params.tab);
  const adminPath = tab ? `/admin?tab=${encodeURIComponent(tab)}` : "/admin";
  const role = await getCurrentAuthRole();

  if (!role) {
    redirect(`/auth/login?next=${encodeURIComponent(adminPath)}`);
  }

  if (role !== "admin") {
    redirect("/");
  }

  return (
    <>
      <Navbar />
      <Suspense fallback={null}>
        <AdminHub />
      </Suspense>
    </>
  );
}
