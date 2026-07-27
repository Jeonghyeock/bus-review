"use client";

import { useQuery } from "@tanstack/react-query";

import type { LatLng } from "@/lib/bus/types";

// 노선 경로(형상)는 변하지 않으므로 오래 캐시.
export function useRoutePath(routeId: string | null) {
  return useQuery({
    queryKey: ["routePath", routeId],
    enabled: !!routeId,
    staleTime: Infinity,
    queryFn: async (): Promise<LatLng[]> => {
      const res = await fetch(`/api/routes/${routeId}/path`);
      if (!res.ok) throw new Error("경로 조회 실패");
      const data = (await res.json()) as { path: LatLng[] };
      return data.path;
    },
  });
}
