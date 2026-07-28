"use client";

import { useQuery } from "@tanstack/react-query";

import type { Stop } from "@/lib/bus/types";

export type Bounds = { swLat: number; swLng: number; neLat: number; neLng: number };

export function useStopsInView(bounds: Bounds | null, enabled = true) {
  // 미세 이동 시 재조회 줄이기 위해 소수 3자리로 반올림한 키
  const key = bounds
    ? [bounds.swLat, bounds.swLng, bounds.neLat, bounds.neLng].map((n) => n.toFixed(3))
    : [];
  return useQuery({
    queryKey: ["stops", "inview", ...key],
    enabled: enabled && !!bounds,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<Stop[]> => {
      const b = bounds!;
      const res = await fetch(
        `/api/stops/in-view?swLat=${b.swLat}&swLng=${b.swLng}&neLat=${b.neLat}&neLng=${b.neLng}`,
      );
      if (!res.ok) throw new Error("정류장 조회 실패");
      const data = (await res.json()) as { stops: Stop[] };
      return data.stops;
    },
  });
}
