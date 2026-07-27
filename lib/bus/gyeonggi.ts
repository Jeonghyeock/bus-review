// 경기 버스 API 어댑터 (TODO)
// GBIS(경기버스정보)/공공데이터포털 응답 → 공통 타입으로 변환.
// 서울과 정류장/노선 ID 체계가 다르므로 정규화 시 region:"gyeonggi" 부여.

import type { Arrival, Stop } from "./types";

export async function getGyeonggiStopsNearby(
  _lat: number,
  _lng: number,
  _radius: number,
): Promise<Stop[]> {
  throw new Error("TODO: 경기 정류소 근접조회 API 연동");
}

export async function getGyeonggiArrivals(_stopId: string): Promise<Arrival[]> {
  throw new Error("TODO: 경기 버스도착정보 API 연동");
}
