"use client";

import { createBrowserClient } from "@supabase/ssr";

function publicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  return { publishableKey, url };
}

export function createSupabaseBrowserClient() {
  const { publishableKey, url } = publicSupabaseConfig();
  return createBrowserClient(url, publishableKey);
}
