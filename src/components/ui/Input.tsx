"use client";

import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-secondary-sand/70 bg-white px-3 py-2.5 text-sm font-medium text-primary-charcoal outline-none transition placeholder:text-primary-charcoal/35 focus:border-primary-green focus:ring-4 focus:ring-primary-green/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100",
        className,
      )}
      {...props}
    />
  );
}
