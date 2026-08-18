"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useModalA11y } from "@/hooks/useModalA11y";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  label: string;
  className?: string;
  overlayClassName?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, label, className, overlayClassName, children }: ModalProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(open, onClose);

  if (!open) {
    return null;
  }

  return (
    <div className={cn("fixed inset-0 z-[100] grid place-items-center bg-primary-charcoal/50 px-4 py-8 backdrop-blur-sm", overlayClassName)}>
      <div
        aria-label={label}
        aria-modal="true"
        className={cn(
          "w-full max-w-lg rounded-2xl border border-secondary-sand bg-white p-5 shadow-[0_24px_70px_rgb(31,31,31,0.22)] dark:border-zinc-700 dark:bg-zinc-900",
          className,
        )}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
