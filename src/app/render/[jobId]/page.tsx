import { notFound } from "next/navigation";
import { LeaderboardCanvas } from "@/components/leaderboard/LeaderboardCanvas";
import { readExportJob } from "@/lib/leaderboard/export-jobs";
import { OutputFormatSchema } from "@/lib/leaderboard/schema";

export const dynamic = "force-dynamic";

interface RenderPageProps {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ format?: string }>;
}

export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const [{ jobId }, query] = await Promise.all([params, searchParams]);
  const spec = readExportJob(jobId);
  const formatResult = OutputFormatSchema.safeParse(query.format ?? "story");

  if (!spec || !formatResult.success) {
    notFound();
  }

  return (
    <main className="grid min-h-screen place-items-start bg-transparent">
      <LeaderboardCanvas format={formatResult.data} spec={spec} />
    </main>
  );
}
