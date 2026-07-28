"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { SUPABASE_ENABLED, createClient } from "./client";

type UserContextValue = {
  user: User | null;
  loading: boolean;
  enabled: boolean;
  signInWithEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | null>(null);

// 앱 전체에서 Supabase 세션을 한 번만 구독 (컴포넌트마다 클라이언트/리스너 생성 방지)
export function UserProvider({ children }: { children: React.ReactNode }) {
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

  const value = useMemo(
    () => ({ user, loading, enabled: SUPABASE_ENABLED, signInWithEmail, signOut }),
    [user, loading, signInWithEmail, signOut],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}
