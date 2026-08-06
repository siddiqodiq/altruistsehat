"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT_CLASSNAMES: Record<ButtonVariant, string> = {
  primary: "bg-primary-brown text-white hover:bg-primary-brown/90",
  secondary:
    "border border-secondary-sand bg-white text-primary-charcoal hover:bg-secondary-sand/25 dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-primary-charcoal/65 hover:bg-secondary-sand/35 dark:text-gray-300 dark:hover:bg-zinc-800",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100",
        VARIANT_CLASSNAMES[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
