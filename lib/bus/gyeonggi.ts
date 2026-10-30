// 경기 버스 어댑터 (GBIS, data.go.kr 6410000). 정류소·도착 모두 GBIS = stationId 체계 일치.
// .env: GYEONGGI_BUS_API_KEY = data.go.kr Decoding 인증키 (서버 전용).

import { XMLParser } from "fast-xml-parser";

import { ROUTE_TYPE } from "./labels";
import type { Arrival, BusPosition, LatLng, RouteStation, Stop } from "./types";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GBIS 는 오류도 HTTP 200 으로 보내고 msgHeader.resultCode 로 알린다. 오류를 '결과 없음'으로 넘기면 빈 결과가 캐시에 남으므로 던진다.
// 결과로 보는 코드: 0 정상, 4 결과 없음(실제 호출로 확인, msgBody 없음), 23 버스 도착 정보 없음(GBIS 활용 가이드).
// 그 밖의 코드(1 시스템 에러, 2·3 파라미터, 5~7 인증키, 8 요청 제한 초과, 99 준비중 등)는 오류.
function checkGbisResult(path: string, data: any): any {
  // 인증키 오류 등은 공공데이터포털 게이트웨이가 response 대신 OpenAPI_ServiceResponse 로 답한다
  if (data?.OpenAPI_ServiceResponse) {
    throw new Error(`GBIS ${path} 실패: ${JSON.stringify(data.OpenAPI_ServiceResponse)}`);
  }
  const header = data?.response?.msgHeader;
  if (!header) throw new Error(`GBIS ${path} 실패: msgHeader 없음`);
  const code = num(header.resultCode);
  if (code === 0 || code === 4 || code === 23) return data;
  throw new Error(`GBIS ${path} 실패: resultCode ${header.resultCode} (${header.resultMessage})`);
}

async function callGbis(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ serviceKey: apiKey(), format: "json", ...params });
  // 429(rate limit)는 짧게 backoff 후 최대 2회 재시도
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}?${qs}`, { cache: "no-store" });
    if (res.ok) return checkGbisResult(path, parseResp(await res.text()));
    // 읽지 않은 본문은 버려야 연결이 바로 풀린다
    await res.body?.cancel();
    if (res.status === 429 && attempt < 2) {
      await sleep(300 * (attempt + 1));
      continue;
    }
    throw new Error(`GBIS ${path} 실패: ${res.status}`);
  }
}

function mapStation(it: any): Stop {
  return {
    id: String(it.stationId),
    region: "gyeonggi",
    name: String(it.stationName),
    lat: Number(it.y),
    lng: Number(it.x),
    stationNo: it.mobileNo ? String(it.mobileNo).trim() : undefined,
  };
}

function validStop(s: Stop): boolean {
  return !!s.id && Number.isFinite(s.lat) && Number.isFinite(s.lng);
}

// 정류소명/번호 검색
export async function searchGyeonggiStops(keyword: string): Promise<Stop[]> {
  const data = await callGbis("/busstationservice/v2/getBusStationListv2", { keyword });
  return toArray<any>(data?.response?.msgBody?.busStationList).map(mapStation).filter(validStop);
}

// 셀 단위 근접조회 캐시 (정류소는 불변)
const CELL = 0.006; // 격자 셀 크기(도) ~ 500m
const CELL_CACHE_MAX = 1000; // 캐시 상한 (초과 시 가장 오래된 항목부터 제거)
const cellCache = new Map<string, Stop[]>();

async function stopsInCell(cellLat: number, cellLng: number): Promise<Stop[]> {
  const key = `${cellLat.toFixed(3)},${cellLng.toFixed(3)}`;
  const cached = cellCache.get(key);
  if (cached) return cached;
  const data = await callGbis("/busstationservice/v2/getBusStationAroundListv2", {
    x: String(cellLng),
    y: String(cellLat),
  });
  const stops = toArray<any>(data?.response?.msgBody?.busStationAroundList)
    .map(mapStation)
    .filter(validStop);
  cellCache.set(key, stops);
  // LRU 상한: Map 은 삽입 순서를 보존하므로 가장 오래된 키부터 제거
  if (cellCache.size > CELL_CACHE_MAX) {
    cellCache.delete(cellCache.keys().next().value!);
  }
  return stops;
}

// 동시 실행 수를 제한하는 풀 — GBIS rate limit(429) 회피. 항목 하나가 실패해도 나머지는 계속한다.
// signal 이 취소되면 남은 항목은 꺼내지 않는다(이미 시작한 항목은 끝까지 간다).
async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length && !signal?.aborted) {
      const i = next++;
      try {
        await fn(items[i]);
      } catch {
        /* 항목별 오류는 fn 이 처리한다 */
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

const MAX_CELLS = 24; // 호출량 안전 상한
// 셀을 만드는 창의 반폭(칸). 가까운 MAX_CELLS 칸은 어느 축으로든 중심 칸에서 이 안에 있다(아래 주석).
const WINDOW = Math.ceil(MAX_CELLS / 2) + 1;

// bounds 를 500m 셀 격자로 나누고 "화면 중심에서 가까운 순"으로 정렬 (가운데부터 조회)
// 쓰는 것은 중심에서 가까운 MAX_CELLS 칸뿐이라, 격자 전체가 아니라 중심 칸에서 각 축 ±WINDOW 칸 안만 만든다.
// 그래서 영역을 아무리 넓게 보내도(지도를 크게 축소하거나 좌표를 일부러 넓게) 칸은 최대 27×27 개다.
// 창 밖 칸은 결과에 들지 않는다: 한 축이 창보다 길면 그 축의 중심 줄 ±12칸에만 25칸이 있어
// 24번째 거리가 12.5칸 이하인데, 창 밖 칸은 그 축으로만 13.5칸보다 멀다. 창보다 짧은 축은 원래 창 안에 다 든다.
// 테스트(tests/stops-stream.test.ts)가 격자 전체를 정렬하는 방식과 결과를 견준다.
export function cellsInBounds(
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
): Array<[number, number]> {
  const laMin = Math.floor(sw.lat / CELL);
  const laMax = Math.floor(ne.lat / CELL);
  const lnMin = Math.floor(sw.lng / CELL);
  const lnMax = Math.floor(ne.lng / CELL);
  if (laMin > laMax || lnMin > lnMax) return []; // sw 가 ne 보다 큰 영역 (라우트는 미리 거르지만 직접 부를 때를 위해)
  const cy = (sw.lat + ne.lat) / 2;
  const cx = (sw.lng + ne.lng) / 2;
  const cLa = Math.floor(cy / CELL);
  const cLn = Math.floor(cx / CELL);

  const cells: Array<[number, number]> = [];
  for (let la = Math.max(laMin, cLa - WINDOW); la <= Math.min(laMax, cLa + WINDOW); la++) {
    for (let ln = Math.max(lnMin, cLn - WINDOW); ln <= Math.min(lnMax, cLn + WINDOW); ln++) {
      cells.push([(la + 0.5) * CELL, (ln + 0.5) * CELL]);
    }
  }
  const dist2 = ([la, ln]: [number, number]) => (la - cy) ** 2 + (ln - cx) ** 2;
  cells.sort((a, b) => dist2(a) - dist2(b));

  if (cells.length > MAX_CELLS) {
    const total = (laMax - laMin + 1) * (lnMax - lnMin + 1);
    console.warn(`[gyeonggi] bounds 셀 ${total}개 → ${MAX_CELLS}개로 제한 (외곽 일부 미조회)`);
    cells.length = MAX_CELLS;
  }
  return cells;
}

// 중심 셀부터 조회하고, 완료되는 셀마다 onCell 로 흘려보낸다 (동시 6개, 429 회피).
// 실패한 셀은 건너뛰고 나머지를 계속 보내며, 몇 칸이 실패했는지 돌려준다('정류소 없음'과 '조회 실패'를 구분하려고).
// signal 이 취소되면(클라이언트가 끊음) 남은 셀은 조회하지 않는다. 이미 시작한 셀은 끝까지 받아 캐시에 남긴다 —
// 공공 API 는 요청을 받는 순간 호출로 세므로 중간에 끊어도 한도가 아껴지지 않고, 겹치는 다음 영역에서 다시 쓸 수 있다.
export async function streamGyeonggiStopsInBounds(
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
  onCell: (stops: Stop[]) => void,
  signal?: AbortSignal,
): Promise<{ failed: number; total: number; started: number }> {
  const cells = cellsInBounds(sw, ne);
  let failed = 0;
  let started = 0;
  await runPool(
    cells,
    6,
    async ([la, ln]) => {
      started++;
      try {
        const stops = await stopsInCell(la, ln);
        if (stops.length) onCell(stops);
      } catch (e) {
        failed++;
        console.error("[gyeonggi] 셀 조회 실패:", e);
      }
    },
    signal,
  );
  return { failed, total: cells.length, started };
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

// 노선 경유 정류소 목록(순번순)
export async function getGyeonggiRouteStations(routeId: string): Promise<RouteStation[]> {
  const data = await callGbis("/busrouteservice/v2/getBusRouteStationListv2", { routeId });
  return toArray<any>(data?.response?.msgBody?.busRouteStationList)
    .map((it) => ({
      id: String(it.stationId),
      name: String(it.stationName),
      seq: Number(it.stationSeq),
      lat: Number(it.y),
      lng: Number(it.x),
    }))
    .filter((s) => Number.isFinite(s.seq))
    .sort((a, b) => a.seq - b.seq);
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
// 처음 열면 캐시가 비어 버스마다 정류소 조회가 나가므로, 셀 조회처럼 동시 6개로 제한한다(429 로 버스가 빠지지 않게).
export async function getGyeonggiBusPositions(routeId: string): Promise<BusPosition[]> {
  const data = await callGbis("/buslocationservice/v2/getBusLocationListv2", { routeId });
  const buses = toArray<any>(data?.response?.msgBody?.busLocationList);
  // 결과는 버스 순서대로 같은 자리에 넣는다
  const coords: Array<{ lat: number; lng: number } | null> = [];
  await runPool(
    buses.map((_, i) => i),
    6,
    async (i) => {
      coords[i] = await stationCoord(String(buses[i].stationId));
    },
  );

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
      stationSeq: num(b.stationSeq),
    });
  });
  return result;
}
