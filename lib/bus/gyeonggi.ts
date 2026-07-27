// 경기 버스 어댑터 (GBIS, data.go.kr 6410000). 정류소·도착 모두 GBIS = stationId 체계 일치.
// .env: GYEONGGI_BUS_API_KEY = data.go.kr Decoding 인증키 (서버 전용).

import { XMLParser } from "fast-xml-parser";

import { ROUTE_TYPE } from "./labels";
import type { Arrival, BusPosition, LatLng, Stop } from "./types";

const BASE = "https://apis.data.go.kr/6410000";
const xml = new XMLParser({ ignoreAttributes: true, parseTagValue: true });

function apiKey(): string {
  const k = process.env.GYEONGGI_BUS_API_KEY;
  if (!k) throw new Error("GYEONGGI_BUS_API_KEY 미설정 (.env.local)");
  return k;
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// 빈 문자열/누락은 undefined, 아니면 숫자
function num(v: unknown): number | undefined {
  if (v === "" || v == null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// GBIS 는 JSON/XML 둘 다 반환 가능 — 둘 다 같은 논리 구조(response.msgBody.*)로 파싱.
function parseResp(text: string): any {
  const t = text.trimStart();
  return t.startsWith("<") ? xml.parse(text) : JSON.parse(text);
}

async function callGbis(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ serviceKey: apiKey(), format: "json", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GBIS ${path} 실패: ${res.status}`);
  return parseResp(await res.text());
}

// 좌표 반경 500m 주변 정류소
export async function getGyeonggiStopsNearby(
  lat: number,
  lng: number,
  _radius: number,
): Promise<Stop[]> {
  const data = await callGbis("/busstationservice/v2/getBusStationAroundListv2", {
    x: String(lng), // 경도
    y: String(lat), // 위도
  });
  const items = toArray<any>(data?.response?.msgBody?.busStationAroundList);
  return items
    .map((it) => ({
      id: String(it.stationId),
      region: "gyeonggi" as const,
      name: String(it.stationName),
      lat: Number(it.y),
      lng: Number(it.x),
      stationNo: it.mobileNo ? String(it.mobileNo).trim() : undefined,
    }))
    .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

// 정류소명/번호 검색
export async function searchGyeonggiStops(keyword: string): Promise<Stop[]> {
  const data = await callGbis("/busstationservice/v2/getBusStationListv2", { keyword });
  const items = toArray<any>(data?.response?.msgBody?.busStationList);
  return items
    .map((it) => ({
      id: String(it.stationId),
      region: "gyeonggi" as const,
      name: String(it.stationName),
      lat: Number(it.y),
      lng: Number(it.x),
      stationNo: it.mobileNo ? String(it.mobileNo).trim() : undefined,
    }))
    .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

// 정류소 실시간 도착 — getBusArrivalListv2 응답에 routeName 이 포함돼 그대로 사용.
export async function getGyeonggiArrivals(stationId: string): Promise<Arrival[]> {
  const data = await callGbis("/busarrivalservice/v2/getBusArrivalListv2", { stationId });
  const arrivals = toArray<any>(data?.response?.msgBody?.busArrivalList);

  return arrivals
    .map((a) => {
      const predict = num(a.predictTime1);
      const predict2 = num(a.predictTime2);
      const seats = num(a.remainSeatCnt1);
      return {
        routeId: String(a.routeId),
        routeName: String(a.routeName),
        routeType: ROUTE_TYPE[Number(a.routeTypeCd)],
        destName: a.routeDestName ? String(a.routeDestName) : undefined,
        predictMinutes: predict ?? 0,
        remainStops: num(a.locationNo1),
        crowded: num(a.crowded1),
        lowPlate: Number(a.lowPlate1) === 1,
        remainSeats: seats != null && seats >= 0 ? seats : undefined,
        plateNo: a.plateNo1 ? String(a.plateNo1) : undefined,
        next: predict2 != null ? { predictMinutes: predict2, remainStops: num(a.locationNo2) } : undefined,
        message: predict == null ? "도착 정보 없음" : undefined,
      };
    })
    .sort((a, b) => {
      // 도착 예정 있는 노선을 위로, 가까운 순
      if (a.message && !b.message) return 1;
      if (!a.message && b.message) return -1;
      return a.predictMinutes - b.predictMinutes;
    });
}

// stationId → 좌표 캐시 (좌표는 불변이므로 프로세스 내 재사용)
const stationCoordCache = new Map<string, { lat: number; lng: number } | null>();

async function stationCoord(stationId: string): Promise<{ lat: number; lng: number } | null> {
  const cached = stationCoordCache.get(stationId);
  if (cached !== undefined) return cached;
  try {
    const data = await callGbis("/busstationservice/v2/busStationInfov2", { stationId });
    const info = data?.response?.msgBody?.busStationInfo;
    const lat = Number(info?.y);
    const lng = Number(info?.x);
    const coord = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    stationCoordCache.set(stationId, coord);
    return coord;
  } catch {
    return null;
  }
}

// 노선 형상(경로) 좌표 — 도로를 따라가는 폴리라인용.
export async function getGyeonggiRoutePath(routeId: string): Promise<LatLng[]> {
  const data = await callGbis("/busrouteservice/v2/getBusRouteLineListv2", { routeId });
  const items = toArray<any>(data?.response?.msgBody?.busRouteLineList);
  return items
    .map((it) => ({ seq: Number(it.lineSeq), lat: Number(it.y), lng: Number(it.x) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .sort((a, b) => a.seq - b.seq)
    .map(({ lat, lng }) => ({ lat, lng }));
}

// 노선의 실시간 버스 위치. 위치 API 는 stationId 만 주므로 좌표로 변환(캐시).
export async function getGyeonggiBusPositions(routeId: string): Promise<BusPosition[]> {
  const data = await callGbis("/buslocationservice/v2/getBusLocationListv2", { routeId });
  const buses = toArray<any>(data?.response?.msgBody?.busLocationList);
  const coords = await Promise.all(buses.map((b) => stationCoord(String(b.stationId))));

  const result: BusPosition[] = [];
  buses.forEach((b, i) => {
    const c = coords[i];
    if (!c) return;
    const seats = num(b.remainSeatCnt);
    result.push({
      id: String(b.vehId ?? b.plateNo),
      lat: c.lat,
      lng: c.lng,
      plateNo: String(b.plateNo),
      crowded: num(b.crowded),
      remainSeats: seats != null && seats >= 0 ? seats : undefined,
      lowPlate: Number(b.lowPlate) === 1,
    });
  });
  return result;
}
