// 버스 데이터 진입점. region 을 보고 provider 어댑터(seoul/gyeonggi)를 선택한다.
// 실 API 준비 전에는 BUS_USE_MOCK=true 로 목업 반환.

import {
  getGyeonggiArrivals,
  getGyeonggiBusPositions,
  getGyeonggiRoutePath,
  getGyeonggiStopsInBounds,
  getGyeonggiStopsNearby,
  searchGyeonggiStops,
} from "./gyeonggi";
import { MOCK_STOPS, mockArrivals } from "./mock";
import { mockBusPositions } from "./mockBuses";
import type { Arrival, BusPosition, LatLng, Stop } from "./types";

const USE_MOCK = process.env.BUS_USE_MOCK !== "false";

export async function getStopsNearby(lat: number, lng: number, radius = 500): Promise<Stop[]> {
  if (USE_MOCK) return MOCK_STOPS;
  return getGyeonggiStopsNearby(lat, lng, radius);
}

// 보이는 지도 영역(bounds) 내 정류소 — 500m 셀 격자로 넓게 커버
export async function getStopsInBounds(
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
): Promise<Stop[]> {
  if (USE_MOCK) return MOCK_STOPS;
  return getGyeonggiStopsInBounds(sw, ne);
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

export async function getRoutePath(routeId: string): Promise<LatLng[]> {
  if (USE_MOCK) return [];
  return getGyeonggiRoutePath(routeId);
}
