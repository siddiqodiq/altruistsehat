"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { ActivityListItem } from "@/lib/activities/api";
import { cn } from "@/lib/utils";

type ActivityLogoTitleElement = "h1" | "h2" | "h3" | "span";

interface ActivityLogoTitleProps {
  activity: Pick<ActivityListItem, "logoHasWhiteOutline" | "logoUrl" | "name">;
  as?: ActivityLogoTitleElement;
  className?: string;
  fallbackClassName?: string;
  logoClassName?: string;
}

export function ActivityLogoTitle({
  activity,
  as: Tag = "span",
  className,
  fallbackClassName,
  logoClassName,
}: ActivityLogoTitleProps) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showLogo = Boolean(activity.logoUrl && failedLogoUrl !== activity.logoUrl);

  if (activity.logoUrl && showLogo) {
    return (
      <Tag aria-label={activity.name} className={cn("block min-w-0", className)}>
        <img
          alt={activity.name}
          className={cn("block h-auto max-w-full object-contain", activity.logoHasWhiteOutline && "activity-logo-white-outline", logoClassName)}
          onError={() => setFailedLogoUrl(activity.logoUrl ?? null)}
          src={activity.logoUrl}
        />
      </Tag>
    );
  }

  return (
    <Tag className={cn("min-w-0", className, fallbackClassName)}>
      {activity.name}
    </Tag>
  );
}
