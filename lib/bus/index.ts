// 버스 데이터 진입점. region 을 보고 provider 어댑터(seoul/gyeonggi)를 선택한다.
// 실 API 준비 전에는 BUS_USE_MOCK=true 로 목업 반환.

import {
  getGyeonggiArrivals,
  getGyeonggiBusPositions,
  getGyeonggiStopsNearby,
  searchGyeonggiStops,
} from "./gyeonggi";
import { MOCK_STOPS, mockArrivals } from "./mock";
import { mockBusPositions } from "./mockBuses";
import type { Arrival, BusPosition, Stop } from "./types";

const USE_MOCK = process.env.BUS_USE_MOCK !== "false";

export async function getStopsNearby(lat: number, lng: number, radius = 500): Promise<Stop[]> {
  if (USE_MOCK) return MOCK_STOPS;

  // 서울(TOPIS)은 화재로 키 동기화 지연 중 → 현재는 경기(경기데이터드림) 실데이터 사용.
  // 서울 복구 시 seoul.ts 어댑터를 좌표로 병합 호출.
  return getGyeonggiStopsNearby(lat, lng, radius);
}

export async function getArrivals(stopId: string): Promise<Arrival[]> {
  if (USE_MOCK) return mockArrivals(stopId);
  return getGyeonggiArrivals(stopId);
}

export async function getBusPositions(routeId: string): Promise<BusPosition[]> {
  if (USE_MOCK) return mockBusPositions(routeId, Math.floor(Date.now() / 1000));
  return getGyeonggiBusPositions(routeId);
}

export async function searchStops(keyword: string): Promise<Stop[]> {
  if (USE_MOCK) return MOCK_STOPS.filter((s) => s.name.includes(keyword));
  return searchGyeonggiStops(keyword);
}
