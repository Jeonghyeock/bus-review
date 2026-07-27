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
}: {
  targetType: ReviewTargetType;
  targetId: string;
  region: Region;
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
      <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-400">
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
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">리뷰 {reviews ? `(${reviews.length})` : ""}</h3>
        {avg && <span className="text-sm text-yellow-500">★ {avg}</span>}
      </div>

      {user ? (
        <form onSubmit={handleSubmit} className="mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <RatingStars value={rating} onChange={setRating} />
            <button type="button" onClick={signOut} className="text-xs text-gray-400">
              로그아웃
            </button>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="이 노선/정류장 어떤가요?"
            className="w-full rounded border border-gray-200 p-2 text-sm"
            rows={2}
          />
          <button
            disabled={addReview.isPending}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {addReview.isPending ? "등록 중…" : "리뷰 등록"}
          </button>
          {addReview.isError && (
            <p className="text-xs text-red-500">등록 실패: {(addReview.error as Error).message}</p>
          )}
        </form>
      ) : magicSent ? (
        <p className="mt-2 text-sm text-gray-600">
          메일함을 확인해 로그인 링크를 눌러주세요. (같은 브라우저에서 열어야 합니다)
        </p>
      ) : (
        <form onSubmit={handleLogin} className="mt-2 flex gap-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일로 로그인"
            className="flex-1 rounded border border-gray-200 p-2 text-sm"
          />
          <button className="whitespace-nowrap rounded border border-gray-300 px-3 py-1.5 text-sm">
            링크 받기
          </button>
        </form>
      )}
      {loginError && <p className="mt-1 text-xs text-red-500">{loginError}</p>}

      <ul className="mt-3 divide-y">
        {isPending && <li className="py-2 text-sm text-gray-400">불러오는 중…</li>}
        {reviews?.length === 0 && (
          <li className="py-2 text-sm text-gray-400">아직 리뷰가 없어요. 첫 리뷰를 남겨보세요!</li>
        )}
        {reviews?.map((r) => (
          <li key={r.id} className="py-2">
            <div className="flex items-center gap-2">
              <RatingStars value={r.rating} size={14} />
              <span className="text-xs text-gray-500">{r.profiles?.nickname ?? "익명"}</span>
            </div>
            {r.content && <p className="mt-1 text-sm">{r.content}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
