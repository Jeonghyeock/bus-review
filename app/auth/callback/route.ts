import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// OAuth 로그인 후 리다이렉트되는 콜백 — code 를 세션으로 교환하고 홈으로.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(origin);
}
