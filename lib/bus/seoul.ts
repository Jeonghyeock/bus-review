// 서울 버스 API 어댑터 (서울 TOPIS OpenAPI, ws.bus.go.kr)
// XML 응답을 공통 타입(Stop/Arrival)으로 정규화한다.
// CORS·키 보호 때문에 반드시 서버(Route Handler)에서만 호출.
//
// .env: SEOUL_BUS_API_KEY 에는 공공데이터포털의 "Decoding" 인증키를 넣는다.
// (URLSearchParams 가 한 번 인코딩하므로 Encoding 키를 넣으면 이중 인코딩으로 깨진다.)

import { XMLParser } from "fast-xml-parser";

import type { Arrival, Stop } from "./types";

const BASE = "http://ws.bus.go.kr/api/rest";

// 숫자 문자열(arsId 등)의 앞자리 0 유실을 막기 위해 값 파싱을 끈다.
const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false });

function serviceKey(): string {
  const key = process.env.SEOUL_BUS_API_KEY;
  if (!key) throw new Error("SEOUL_BUS_API_KEY 미설정 (.env.local)");
  return key;
}

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// arrmsg1 예: "3분5초후[2번째 전]" → 2
function parseRemainStops(msg: string): number | undefined {
  const m = msg.match(/\[(\d+)번째/);
  return m ? Number(m[1]) : undefined;
}

// 좌표 기반 근접 정류소 조회 (getStationByPos)
export async function getSeoulStopsNearby(
  lat: number,
  lng: number,
  radius: number,
): Promise<Stop[]> {
  const params = new URLSearchParams({
    serviceKey: serviceKey(),
    tmX: String(lng), // 경도
    tmY: String(lat), // 위도
    radius: String(radius),
  });
  const res = await fetch(`${BASE}/stationinfo/getStationByPos?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`서울 정류소 조회 실패: ${res.status}`);

  const data = parser.parse(await res.text());
  const items = toArray<Record<string, string>>(data?.ServiceResult?.msgBody?.itemList);

  return items
    .map((it) => ({
      id: String(it.arsId),
      region: "seoul" as const,
      name: String(it.stationNm),
      lat: Number(it.gpsY),
      lng: Number(it.gpsX),
    }))
    .filter((s) => s.id && s.id !== "0" && Number.isFinite(s.lat) && Number.isFinite(s.lng));
}

// 정류소별 실시간 도착 조회 (getStationByUid, arsId 기준)
export async function getSeoulArrivals(arsId: string): Promise<Arrival[]> {
  const params = new URLSearchParams({ serviceKey: serviceKey(), arsId });
  const res = await fetch(`${BASE}/stationinfo/getStationByUid?${params}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`서울 도착정보 조회 실패: ${res.status}`);

  const data = parser.parse(await res.text());
  const items = toArray<Record<string, string>>(data?.ServiceResult?.msgBody?.itemList);

  return items.map((it) => {
    const message = it.arrmsg1 != null ? String(it.arrmsg1) : undefined;
    const traTime = Number(it.traTime1);
    return {
      routeId: String(it.rtId ?? it.busRouteId ?? it.rtNm),
      routeName: String(it.rtNm),
      predictMinutes: Number.isFinite(traTime) ? Math.max(0, Math.round(traTime / 60)) : 0,
      remainStops: message ? parseRemainStops(message) : undefined,
      message,
    };
  });
}
