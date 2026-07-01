"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Kegiatan" },
  { href: "/leaderboard", label: "Leaderboard" },
] as const;

function isActiveTab(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppTabs() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex w-full max-w-7xl gap-2 px-3 py-3 sm:px-5">
        {TABS.map((tab) => {
          const isActive = isActiveTab(pathname, tab.href);
          return (
            <Link
              className={cn(
                "inline-flex items-center rounded-[8px] px-3 py-2 text-sm font-black transition",
                isActive ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-700 hover:bg-zinc-100",
              )}
              href={tab.href}
              key={tab.href}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
