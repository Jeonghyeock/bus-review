"use client";

import { useQuery } from "@tanstack/react-query";

import type { BusPosition } from "@/lib/bus/types";

// 노선 실시간 버스 위치 — 15초 폴링.
export function useBusPositions(routeId: string | null) {
  return useQuery({
    queryKey: ["buses", routeId],
    enabled: !!routeId,
    refetchInterval: 15_000,
    queryFn: async (): Promise<BusPosition[]> => {
      const res = await fetch(`/api/routes/${routeId}/buses`);
      if (!res.ok) throw new Error("버스 위치 조회 실패");
      const data = (await res.json()) as { buses: BusPosition[] };
      return data.buses;
    },
  });
}
