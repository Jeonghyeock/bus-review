// 버스 데이터 진입점. 지금은 경기(GBIS) 어댑터만 부른다.
// 서울을 붙일 때: 도착·노선 조회는 region 으로 어댑터를 고르고, 주변 정류장·검색은 두 지역을 함께 조회해 합친다.
// BUS_USE_MOCK 가 "false" 가 아니면(값이 없어도) 목업을 반환한다.

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
  signal?: AbortSignal,
): Promise<{ failed: number; total: number; queried: number }> {
  if (USE_MOCK) {
    onCell(MOCK_STOPS);
    return { failed: 0, total: 1, queried: 1 };
  }
  return streamGyeonggiStopsInBounds(sw, ne, onCell, signal);
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
