// 경기 버스 어댑터 (경기데이터드림, openapi.gg.go.kr — JSON).
// 정류소: BusStation(시군 단위) → 좌표로 근접 필터. 도착정보: 추후 "버스 도착 정보 조회" 연동.
// .env: GYEONGGI_BUS_API_KEY = 경기데이터드림 인증키 (서버 전용).

import type { Arrival, Stop } from "./types";

const GG_BASE = "https://openapi.gg.go.kr";

function apiKey(): string {
  const k = process.env.GYEONGGI_BUS_API_KEY;
  if (!k) throw new Error("GYEONGGI_BUS_API_KEY 미설정 (.env.local)");
  return k;
}

// 경기데이터드림 JSON 형식: { <SERVICE>: [ { head: [...] }, { row: [...] } ] }
function extractRows(json: unknown, service: string): Record<string, unknown>[] {
  const svc = (json as Record<string, unknown>)?.[service];
  if (!Array.isArray(svc)) return [];
  const rowBlock = svc.find((b) => Array.isArray((b as Record<string, unknown>)?.row));
  return ((rowBlock as Record<string, unknown[]>)?.row as Record<string, unknown>[]) ?? [];
}

// 두 좌표 간 거리(m)
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// 경기 근접 정류소 — 경기데이터드림엔 좌표조회가 없어 시군 목록을 받아 클라이언트에서 거리 필터.
// TODO: 좌표 → 시군 매핑 (현재는 수원시 고정). 시군당 정류소가 많으면 pIndex 페이지네이션.
export async function getGyeonggiStopsNearby(
  lat: number,
  lng: number,
  radius: number,
): Promise<Stop[]> {
  const params = new URLSearchParams({
    KEY: apiKey(),
    Type: "json",
    pIndex: "1",
    pSize: "1000",
    SIGUN_NM: "수원시",
  });
  const res = await fetch(`${GG_BASE}/BusStation?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`경기 정류소 조회 실패: ${res.status}`);

  const rows = extractRows(await res.json(), "BusStation");
  return rows
    .map((r) => ({
      id: String(r.STATION_ID),
      region: "gyeonggi" as const,
      name: String(r.STATION_NM_INFO),
      lat: Number(r.WGS84_LAT),
      lng: Number(r.WGS84_LOGT),
    }))
    .filter(
      (s) =>
        s.id &&
        Number.isFinite(s.lat) &&
        Number.isFinite(s.lng) &&
        distanceMeters(lat, lng, s.lat, s.lng) <= radius,
    );
}

export async function getGyeonggiArrivals(_stationId: string): Promise<Arrival[]> {
  // TODO: 경기데이터드림 "버스 도착 정보 조회" API 연동 (스펙 확인 후 구현)
  return [];
}
