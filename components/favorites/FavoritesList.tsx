"use client";

import { Star } from "lucide-react";

import { type Favorite, useFavorites } from "@/lib/query/useFavorites";
import { useUser } from "@/lib/supabase/useUser";

export default function FavoritesList({ onSelect }: { onSelect: (f: Favorite) => void }) {
  const { user } = useUser();
  const { data: favs } = useFavorites(user?.id);

  if (!user || !favs?.length) return null;

  return (
    <div className="mb-4">
      <h3 className="flex items-center gap-1 text-sm font-bold text-gray-900">
        <Star size={14} className="fill-amber-400 text-amber-400" /> 즐겨찾기
      </h3>
      <ul className="mt-1 space-y-0.5">
        {favs.map((f) => (
          <li key={`${f.target_type}-${f.target_id}`}>
            <button
              onClick={() => onSelect(f)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
            >
              <span className="shrink-0 text-xs text-gray-400">
                {f.target_type === "route" ? "노선" : "정류장"}
              </span>
              <span className="truncate text-sm text-gray-800">{f.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
