import { NextResponse } from "next/server";
import { validateProfilePasswordInput } from "@/lib/profile/summary";
import {
  createSupabaseServerAuthClient,
  getCurrentAuthProfile,
  isSupabaseAuthConfigError,
} from "@/lib/supabase/auth-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const profile = await getCurrentAuthProfile();
  if (!profile) {
    return NextResponse.json({ error: "Login required." }, { status: 401 });
  }

  let input: ReturnType<typeof validateProfilePasswordInput>;
  try {
    input = validateProfilePasswordInput(await request.json().catch(() => null));
  } catch {
    return NextResponse.json({ error: "Data password tidak valid." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerAuthClient();
    const { error } = await supabase.auth.updateUser({
      current_password: input.currentPassword,
      password: input.newPassword,
    });

    if (error) {
      return NextResponse.json({ error: "Password lama tidak valid atau password baru ditolak." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isSupabaseAuthConfigError(error)) {
      return NextResponse.json({ error: "Supabase Auth belum dikonfigurasi." }, { status: 503 });
    }

    return NextResponse.json({ error: "Password gagal diperbarui." }, { status: 500 });
  }
}
