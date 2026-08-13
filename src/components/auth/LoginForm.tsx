"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoginFormState {
  error?: string;
}

type LoginAction = (state: LoginFormState, formData: FormData) => Promise<LoginFormState>;

export function LoginForm({
  action,
  nextPath,
}: {
  action: LoginAction;
  nextPath: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
      <section className="topbar-clearance mx-auto flex min-h-screen w-full max-w-md items-start px-4 pb-20 sm:px-6">
        <div className="w-full rounded-[1.35rem] border border-secondary-sand/70 bg-white/95 p-6 shadow-[0_18px_44px_rgb(90,46,23,0.12)] dark:border-zinc-800 dark:bg-zinc-900/95">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-primary-brown dark:text-secondary-sand">
              Altruist Sehat
            </p>
            <h1 className="font-poppins text-3xl font-black tracking-normal text-primary-charcoal dark:text-white">
              Login
            </h1>
          </div>

          <form action={formAction} className="mt-6 grid gap-4">
            <input name="next" type="hidden" value={nextPath} />
            <label className="grid gap-2 text-sm font-bold">
              Username
              <input
                autoComplete="username"
                className="h-12 rounded-xl border border-secondary-sand bg-white px-4 text-sm font-semibold outline-none transition focus:border-primary-brown focus:ring-2 focus:ring-primary-brown/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                name="username"
                placeholder="user.name"
                required
              />
            </label>
            <label className="grid gap-2 text-sm font-bold">
              Password
              <input
                autoComplete="current-password"
                className="h-12 rounded-xl border border-secondary-sand bg-white px-4 text-sm font-semibold outline-none transition focus:border-primary-brown focus:ring-2 focus:ring-primary-brown/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                name="password"
                placeholder="Password"
                required
                type="password"
              />
            </label>

            {state.error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200" role="alert">
                {state.error}
              </div>
            ) : null}

            <button
              className={cn(
                "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary-green px-5 text-sm font-black text-white transition hover:bg-primary-green/90",
                pending && "cursor-wait opacity-70",
              )}
              disabled={pending}
              type="submit"
            >
              <LogIn className="size-4" />
              {pending ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </section>
  );
}
