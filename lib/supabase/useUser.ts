"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SUPABASE_ENABLED, createClient } from "./client";

export function useUser() {
  const supabase = useMemo(() => (SUPABASE_ENABLED ? createClient() : null), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // 매직링크(이메일) 로그인 — 입력한 이메일로 로그인 링크 발송.
  const signInWithEmail = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!supabase) return { error: new Error("Supabase 미설정") };
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error ?? null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  return { user, loading, enabled: SUPABASE_ENABLED, signInWithEmail, signOut };
}
