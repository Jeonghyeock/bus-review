"use client";

import { useState } from "react";

import type { Region, ReviewTargetType } from "@/lib/bus/types";
import { useAddReview, useReviews } from "@/lib/query/useReviews";
import { useUser } from "@/lib/supabase/useUser";

import RatingStars from "./RatingStars";

export default function ReviewSection({
  targetType,
  targetId,
  region,
  title = "리뷰",
}: {
  targetType: ReviewTargetType;
  targetId: string;
  region: Region;
  title?: string;
}) {
  const { user, enabled, signInWithEmail, signOut } = useUser();
  const { data: reviews, isPending } = useReviews(targetType, targetId);
  const addReview = useAddReview(targetType, targetId, region);

  const [rating, setRating] = useState(5);
  const [content, setContent] = useState("");
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <div className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-400">
        리뷰 기능은 Supabase 설정 후 활성화됩니다.
      </div>
    );
  }

  const avg =
    reviews && reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    addReview.mutate(
      { rating, content: content.trim(), tags: [] },
      { onSuccess: () => setContent("") },
    );
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const { error } = await signInWithEmail(email.trim());
    if (error) setLoginError(error.message);
    else setMagicSent(true);
  };

  return (
    <div className="mt-5 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">
          {title} {reviews ? `${reviews.length}` : ""}
        </h3>
        {avg && (
          <span className="flex items-center gap-1 text-sm font-medium text-amber-500">
            ★ {avg}
          </span>
        )}
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="mt-3 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <RatingStars value={rating} onChange={setRating} />
            <button type="button" onClick={signOut} className="text-xs text-gray-400 hover:text-gray-600">
              로그아웃
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="이 노선/정류장 어떤가요?"
            className="mt-2 w-full resize-none rounded-lg border border-gray-200 bg-white p-2.5 text-sm outline-none focus:border-blue-400"
            rows={2}
          />
          <button
            disabled={addReview.isPending}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {addReview.isPending ? "등록 중…" : "리뷰 등록"}
          </button>
          {addReview.isError && (
            <p className="mt-1 text-xs text-red-500">등록 실패: {(addReview.error as Error).message}</p>
          )}
        </form>
      ) : magicSent ? (
        <p className="mt-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
          메일함을 확인해 로그인 링크를 눌러주세요. (같은 브라우저에서 열어야 합니다)
        </p>
      ) : (
        <form onSubmit={handleLogin} className="mt-3 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일로 로그인하고 리뷰 쓰기"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-blue-400"
          />
          <button className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-50">
            링크 받기
          </button>
        </form>
      )}
      {loginError && <p className="mt-1 text-xs text-red-500">{loginError}</p>}

      <ul className="mt-4 space-y-3">
        {isPending && <li className="text-sm text-gray-400">불러오는 중…</li>}
        {reviews?.length === 0 && (
          <li className="rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
            아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!
          </li>
        )}
        {reviews?.map((r) => (
          <li key={r.id} className="flex gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-100 text-xs font-medium text-gray-500">
              {(r.profiles?.nickname ?? "익")[0]}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <RatingStars value={r.rating} size={13} />
                <span className="text-xs text-gray-500">{r.profiles?.nickname ?? "익명"}</span>
              </div>
              {r.content && <p className="mt-0.5 text-sm text-gray-700">{r.content}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
