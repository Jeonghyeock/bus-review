import type { Arrival, BusRoute, Stop } from "./types";

// 실 API 붙이기 전 개발/데모용 목업 (강남·판교 인근).
export const MOCK_STOPS: Stop[] = [
  { id: "s1", region: "seoul", name: "강남역", lat: 37.4979, lng: 127.0276, routeIds: ["r1", "r2"] },
  { id: "s2", region: "seoul", name: "역삼역", lat: 37.5006, lng: 127.0366, routeIds: ["r2", "r3"] },
  { id: "s3", region: "seoul", name: "선릉역", lat: 37.5045, lng: 127.049, routeIds: ["r3"] },
  { id: "s4", region: "gyeonggi", name: "판교역", lat: 37.3947, lng: 127.1112, routeIds: ["r4"] },
];

export const MOCK_ROUTES: BusRoute[] = [
  { id: "r1", region: "seoul", name: "간선 146", type: "간선" },
  { id: "r2", region: "seoul", name: "지선 3412", type: "지선" },
  { id: "r3", region: "seoul", name: "광역 9401", type: "광역" },
  { id: "r4", region: "gyeonggi", name: "직행 1009", type: "직행" },
];

export function mockArrivals(stopId: string): Arrival[] {
  const stop = MOCK_STOPS.find((s) => s.id === stopId);
  if (!stop?.routeIds) return [];
  return stop.routeIds.map((rid, i) => {
    const route = MOCK_ROUTES.find((r) => r.id === rid)!;
    return {
      routeId: rid,
      routeName: route.name,
      predictMinutes: (i + 1) * 3,
      remainStops: (i + 1) * 2,
    };
  });
}
