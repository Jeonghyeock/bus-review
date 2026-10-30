"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Region, ReviewTargetType } from "@/lib/bus/types";
import { SUPABASE_ENABLED, createClient } from "@/lib/supabase/client";

export type Review = {
  id: string;
  rating: number;
  content: string | null;
  tags: string[];
  created_at: string;
  user_id: string;
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};

export function useReviews(targetType: ReviewTargetType, targetId: string | null) {
  return useQuery({
    queryKey: ["reviews", targetType, targetId],
    enabled: SUPABASE_ENABLED && !!targetId,
    queryFn: async (): Promise<Review[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("reviews")
        .select("id, rating, content, tags, created_at, user_id, profiles(nickname, avatar_url)")
        .eq("target_type", targetType)
        .eq("target_id", targetId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Review[];
    },
  });
}

// 리뷰 본문 상한 — DB 의 reviews_content_length(0008)와 같은 값
export const MAX_REVIEW_LENGTH = 1000;

// 리뷰는 사람마다 대상마다 하나다(0008 의 reviews_user_target_key). 이미 있으면 그 리뷰를 고친다.
export function useAddReview(targetType: ReviewTargetType, targetId: string, region: Region) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { rating: number; content: string; tags: string[] }) => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("reviews").upsert(
        {
          target_type: targetType,
          target_id: targetId,
          region,
          rating: input.rating,
          content: input.content,
          tags: input.tags,
          user_id: uid,
        },
        { onConflict: "user_id,target_type,target_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", targetType, targetId] }),
  });
}
