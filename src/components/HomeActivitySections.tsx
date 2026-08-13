"use client";

import { useEffect, useState } from "react";
import { listHomeActivities, type ActivityListItem } from "@/lib/activities/api";
import type { HomeDocumentationCover, HomeSportVisual } from "@/lib/activities/home-activity-content";
import Features from "@/components/Features";
import LifestyleGallery from "@/components/LifestyleGallery";
import Timeline from "@/components/Timeline";
import ValueProposition from "@/components/ValueProposition";

export default function HomeActivitySections() {
  const [activities, setActivities] = useState<ActivityListItem[]>([]);
  const [documentationCovers, setDocumentationCovers] = useState<HomeDocumentationCover[]>([]);
  const [sportVisuals, setSportVisuals] = useState<HomeSportVisual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadActivities() {
      setLoading(true);
      setError(null);
      try {
        const payload = await listHomeActivities();
        if (active) {
          setActivities(payload.activities);
          setDocumentationCovers(payload.documentationCovers);
          setSportVisuals(payload.sportVisuals);
        }
      } catch {
        if (active) {
          setError("Kegiatan belum bisa dimuat. Coba segarkan halaman sebentar lagi.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadActivities();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <ValueProposition error={error} loading={loading} sportVisuals={sportVisuals} />
      <Features activities={activities} error={error} loading={loading} />
      <LifestyleGallery documentationCovers={documentationCovers} error={error} loading={loading} />
      <Timeline activities={activities} error={error} loading={loading} />
    </>
  );
}
