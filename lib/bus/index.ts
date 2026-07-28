// 버스 데이터 진입점. region 을 보고 provider 어댑터(seoul/gyeonggi)를 선택한다.
// 실 API 준비 전에는 BUS_USE_MOCK=true 로 목업 반환.

import {
  getGyeonggiArrivals,
  getGyeonggiBusPositions,
  getGyeonggiRoutePath,
  getGyeonggiRouteStations,
  searchGyeonggiStops,
  streamGyeonggiStopsInBounds,
} from "./gyeonggi";
import { MOCK_STOPS, mockArrivals } from "./mock";
import { mockBusPositions } from "./mockBuses";
import type { Arrival, BusPosition, LatLng, RouteStation, Stop } from "./types";

const USE_MOCK = process.env.BUS_USE_MOCK !== "false";

// 보이는 지도 영역(bounds) 내 정류소 — 중심 셀부터 조회하며 완료되는 대로 스트리밍
export async function streamStopsInBounds(
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
  onCell: (stops: Stop[]) => void,
): Promise<void> {
  if (USE_MOCK) {
    onCell(MOCK_STOPS);
    return;
  }
  return streamGyeonggiStopsInBounds(sw, ne, onCell);
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

export async function getRouteStations(routeId: string): Promise<RouteStation[]> {
  if (USE_MOCK) return [];
  return getGyeonggiRouteStations(routeId);
}
