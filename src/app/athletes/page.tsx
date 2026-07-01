import { redirect } from "next/navigation";

export default function AthletesPage() {
  redirect("/admin?tab=athletes");
}
