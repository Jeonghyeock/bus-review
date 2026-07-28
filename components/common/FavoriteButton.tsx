"use client";

import { Star } from "lucide-react";

import { type FavoriteInput, useFavorites, useToggleFavorite } from "@/lib/query/useFavorites";
import { useUser } from "@/lib/supabase/useUser";

export default function FavoriteButton({ item }: { item: FavoriteInput }) {
  const { user, enabled } = useUser();
  const { data: favs } = useFavorites(user?.id);
  const toggle = useToggleFavorite(user?.id);

  if (!enabled) return null;

  const isFav =
    favs?.some((f) => f.target_type === item.target_type && f.target_id === item.target_id) ?? false;

  const onClick = () => {
    if (!user) {
      alert("로그인 후 즐겨찾기를 사용할 수 있어요.");
      return;
    }
    toggle.mutate({ item, isFav });
  };

  return (
    <button onClick={onClick} className="shrink-0" aria-label="즐겨찾기" disabled={toggle.isPending}>
      <Star
        size={18}
        className={isFav ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-400"}
      />
    </button>
  );
}
