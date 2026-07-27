"use client";

import { useQuery } from "@tanstack/react-query";

import type { Stop } from "@/lib/bus/types";

export function useStopSearch(keyword: string) {
  return useQuery({
    queryKey: ["stops", "search", keyword],
    enabled: keyword.trim().length >= 2,
    queryFn: async (): Promise<Stop[]> => {
      const res = await fetch(`/api/stops/search?q=${encodeURIComponent(keyword)}`);
      if (!res.ok) throw new Error("검색 실패");
      const data = (await res.json()) as { stops: Stop[] };
      return data.stops;
    },
  });
}
