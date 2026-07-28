"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { Region } from "@/lib/bus/types";
import { SUPABASE_ENABLED, createClient } from "@/lib/supabase/client";

export type FavoriteInput = {
  target_type: "route" | "stop";
  target_id: string;
  region: Region;
  name: string;
  lat?: number;
  lng?: number;
};

export type Favorite = {
  target_type: "route" | "stop";
  target_id: string;
  region: Region;
  name: string;
  lat: number | null;
  lng: number | null;
};

export function useFavorites(userId?: string) {
  return useQuery({
    queryKey: ["favorites", userId],
    enabled: SUPABASE_ENABLED && !!userId,
    queryFn: async (): Promise<Favorite[]> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("favorites")
        .select("target_type, target_id, region, name, lat, lng")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Favorite[];
    },
  });
}

export function useToggleFavorite(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ item, isFav }: { item: FavoriteInput; isFav: boolean }) => {
      const supabase = createClient();
      if (isFav) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("target_type", item.target_type)
          .eq("target_id", item.target_id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("로그인이 필요합니다");
        const { error } = await supabase.from("favorites").insert({ user_id: u.user.id, ...item });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["favorites", userId] }),
  });
}
