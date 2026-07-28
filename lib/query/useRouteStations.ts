"use client";

import { useQuery } from "@tanstack/react-query";

import type { RouteStation } from "@/lib/bus/types";

// 노선 경유 정류소는 변하지 않으므로 오래 캐시.
export function useRouteStations(routeId: string | null) {
  return useQuery({
    queryKey: ["routeStations", routeId],
    enabled: !!routeId,
    staleTime: Infinity,
    queryFn: async (): Promise<RouteStation[]> => {
      const res = await fetch(`/api/routes/${routeId}/stations`);
      if (!res.ok) throw new Error("노선 정류소 조회 실패");
      const data = (await res.json()) as { stations: RouteStation[] };
      return data.stations;
    },
  });
}
