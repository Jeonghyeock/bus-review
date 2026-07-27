// 버스 데이터 진입점. region 을 보고 provider 어댑터(seoul/gyeonggi)를 선택한다.
// 실 API 준비 전에는 BUS_USE_MOCK=true 로 목업 반환.

import { MOCK_STOPS, mockArrivals } from "./mock";
import { getSeoulArrivals, getSeoulStopsNearby } from "./seoul";
import type { Arrival, Stop } from "./types";

const USE_MOCK = process.env.BUS_USE_MOCK !== "false";

export async function getStopsNearby(lat: number, lng: number, radius = 500): Promise<Stop[]> {
  if (USE_MOCK) return MOCK_STOPS;

  // 현재는 서울만. 경기(GBIS) 추가 시: 좌표로 region 판단 → 두 어댑터 병렬 호출 후 병합.
  return getSeoulStopsNearby(lat, lng, radius);
}

export async function getArrivals(stopId: string): Promise<Arrival[]> {
  if (USE_MOCK) return mockArrivals(stopId);

  // TODO 경기 추가 시: stopId 에 region 을 인코딩("seoul:xxx")하거나 쿼리로 받아 어댑터 분기.
  return getSeoulArrivals(stopId);
}
