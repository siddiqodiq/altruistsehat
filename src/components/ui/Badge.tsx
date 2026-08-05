"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "success" | "warning" | "danger";

const TONE_CLASSNAMES: Record<BadgeTone, string> = {
  neutral: "bg-secondary-sand/40 text-primary-charcoal dark:bg-zinc-800 dark:text-gray-200",
  success: "bg-primary-green/12 text-primary-green dark:bg-secondary-teal/15 dark:text-secondary-teal",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-200",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.04em]",
        TONE_CLASSNAMES[tone],
        className,
      )}
      {...props}
    />
  );
}
