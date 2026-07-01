import { Suspense } from "react";
import { AdminHub } from "@/components/admin/AdminHub";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminHub />
    </Suspense>
  );
}
