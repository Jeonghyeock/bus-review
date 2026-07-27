"use client";

import { useQuery } from "@tanstack/react-query";

import type { Arrival } from "@/lib/bus/types";

import { queryKeys } from "./queryKeys";

// 실시간 도착 정보 — 30초 폴링. 정류장 미선택 시 비활성.
export function useArrivals(stopId: string | null) {
  return useQuery({
    queryKey: stopId ? queryKeys.arrivals(stopId) : ["stops", "none", "arrivals"],
    enabled: !!stopId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Arrival[]> => {
      const res = await fetch(`/api/stops/${stopId}/arrivals`);
      if (!res.ok) throw new Error("도착정보 조회 실패");
      const data = (await res.json()) as { arrivals: Arrival[] };
      return data.arrivals;
    },
  });
}
