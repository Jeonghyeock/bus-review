import { createBrowserClient } from "@supabase/ssr";

// Supabase 공개 키: 신규 프로젝트는 PUBLISHABLE_KEY, 구 프로젝트는 ANON_KEY. 둘 다 지원.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 환경변수가 있어야 리뷰/로그인 기능 활성화. 없으면 앱은 그대로 돌되 기능만 비활성.
export const SUPABASE_ENABLED = !!(SUPABASE_URL && SUPABASE_KEY);

// 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트.
export function createClient() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_KEY!);
}
