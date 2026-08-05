"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-secondary-sand/60 bg-white p-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-none",
        className,
      )}
      {...props}
    />
  );
}
