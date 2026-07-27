"use client";

import { useQuery } from "@tanstack/react-query";

import type { Stop } from "@/lib/bus/types";

import { queryKeys } from "./queryKeys";

export function useNearbyStops(lat: number, lng: number) {
  return useQuery({
    queryKey: queryKeys.nearbyStops(lat, lng),
    queryFn: async (): Promise<Stop[]> => {
      const res = await fetch(`/api/stops/nearby?lat=${lat}&lng=${lng}`);
      if (!res.ok) throw new Error("정류장 조회 실패");
      const data = (await res.json()) as { stops: Stop[] };
      return data.stops;
    },
  });
}
