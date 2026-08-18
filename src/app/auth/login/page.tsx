import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import { LoginForm, type LoginFormState } from "@/components/auth/LoginForm";
import { loginRedirectPathForRole, roleFromClaims, safeInternalRedirectPath } from "@/lib/auth/roles";
import { loginCredentialsFromFormData } from "@/lib/auth/username";
import {
  createSupabaseServerAuthClient,
  getCurrentAuthRole,
  isSupabaseAuthConfigError,
} from "@/lib/supabase/auth-server";

interface LoginPageProps {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loginAction(_state: LoginFormState, formData: FormData): Promise<LoginFormState> {
  "use server";

  const nextPath = safeInternalRedirectPath(String(formData.get("next") ?? ""), "/admin");
  const credentials = loginCredentialsFromFormData(formData);
  if (!credentials.username || !credentials.password) {
    return { error: "Username dan password wajib diisi." };
  }

  let supabase: Awaited<ReturnType<typeof createSupabaseServerAuthClient>>;
  try {
    supabase = await createSupabaseServerAuthClient();
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return { error: "Supabase Auth belum dikonfigurasi." };
    }
    throw error;
  }

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    return { error: "Username atau password tidak valid." };
  }

  const claimsResult = signInData.session?.access_token
    ? await supabase.auth.getClaims(signInData.session.access_token)
    : await supabase.auth.getClaims();
  const role = claimsResult.error || !claimsResult.data?.claims ? "user" : roleFromClaims(claimsResult.data.claims);

  redirect(loginRedirectPathForRole(role, nextPath));
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = safeInternalRedirectPath(firstParam(params.next), "/admin");
  const role = await getCurrentAuthRole();

  if (role) {
    redirect(loginRedirectPathForRole(role, nextPath));
  }

  return (
    <main className="min-h-screen bg-primary-beige text-primary-charcoal transition-colors dark:bg-[#121212] dark:text-gray-100" id="main-content">
      <Navbar />
      <LoginForm action={loginAction} nextPath={nextPath} />
    </main>
  );
}
