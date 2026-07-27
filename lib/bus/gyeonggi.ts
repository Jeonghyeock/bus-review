// 경기 버스 어댑터 (GBIS, data.go.kr 6410000). 정류소·도착 모두 GBIS = stationId 체계 일치.
// .env: GYEONGGI_BUS_API_KEY = data.go.kr Decoding 인증키 (서버 전용).

import { XMLParser } from "fast-xml-parser";

import type { Arrival, Stop } from "./types";

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
    }))
    .filter((s) => s.id && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

// 정류소 실시간 도착 — getBusArrivalListv2 응답에 routeName 이 포함돼 그대로 사용.
export async function getGyeonggiArrivals(stationId: string): Promise<Arrival[]> {
  const data = await callGbis("/busarrivalservice/v2/getBusArrivalListv2", { stationId });
  const arrivals = toArray<any>(data?.response?.msgBody?.busArrivalList);

  return arrivals
    .map((a) => {
      const predict = Number(a.predictTime1);
      const hasPredict = a.predictTime1 !== "" && a.predictTime1 != null && Number.isFinite(predict);
      const loc = a.locationNo1;
      return {
        routeId: String(a.routeId),
        routeName: String(a.routeName),
        predictMinutes: hasPredict ? predict : 0,
        remainStops: loc !== "" && loc != null ? Number(loc) : undefined,
        message: hasPredict ? undefined : "도착 정보 없음",
      };
    })
    .sort((a, b) => {
      // 도착 예정 있는 노선을 위로, 가까운 순
      if (a.message && !b.message) return 1;
      if (!a.message && b.message) return -1;
      return a.predictMinutes - b.predictMinutes;
    });
}
