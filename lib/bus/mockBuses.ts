// 실시간 버스 위치 목업 시뮬레이션.
// 실 API(버스위치정보조회)가 화재 이슈로 막혀 있어, 노선의 정류장들을 잇는 경로 위를
// 버스들이 순환 이동하는 것으로 시뮬레이션한다. (실 API 연결 시 이 파일만 교체)

import { MOCK_STOPS } from "./mock";
import type { BusPosition } from "./types";

type LatLng = { lat: number; lng: number };

// 노선이 경유하는 정류장 좌표로 경로(waypoints) 구성. 2개 미만이면 강남 인근 데모 루프.
function waypointsForRoute(routeId: string): LatLng[] {
  const stops = MOCK_STOPS.filter((s) => s.routeIds?.includes(routeId));
  if (stops.length >= 2) return stops.map((s) => ({ lat: s.lat, lng: s.lng }));
  return [
    { lat: 37.4979, lng: 127.0276 },
    { lat: 37.5006, lng: 127.0366 },
    { lat: 37.5045, lng: 127.049 },
    { lat: 37.5, lng: 127.04 },
  ];
}

// t ∈ [0,1) 를 경로 위 한 점으로 (마지막 → 첫 점으로 순환).
function interpolate(wps: LatLng[], t: number): LatLng {
  const segments = wps.length; // 순환하므로 구간 수 = 점 개수
  const pos = t * segments;
  const i = Math.floor(pos) % segments;
  const frac = pos - Math.floor(pos);
  const a = wps[i];
  const b = wps[(i + 1) % segments];
  return { lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac };
}

// tick(초)에 따라 count 대의 버스 위치를 반환. 버스마다 경로상 위상차를 둬 분산 배치.
export function mockBusPositions(routeId: string, tick: number, count = 3): BusPosition[] {
  const wps = waypointsForRoute(routeId);
  const loopSeconds = 60; // 한 바퀴 도는 데 걸리는 시간
  return Array.from({ length: count }, (_, k) => {
    const t = ((tick / loopSeconds + k / count) % 1 + 1) % 1;
    const { lat, lng } = interpolate(wps, t);
    return { id: `${routeId}-bus-${k}`, lat, lng };
  });
}
