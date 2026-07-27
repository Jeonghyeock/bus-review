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

export function useAddReview(targetType: ReviewTargetType, targetId: string, region: Region) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { rating: number; content: string; tags: string[] }) => {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("로그인이 필요합니다");
      const { error } = await supabase.from("reviews").insert({
        target_type: targetType,
        target_id: targetId,
        region,
        rating: input.rating,
        content: input.content,
        tags: input.tags,
        user_id: uid,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reviews", targetType, targetId] }),
  });
}
