import { atom } from "jotai";

import type { Region, Stop } from "@/lib/bus/types";

// 지도 중심 (기본: 수원역 — 경기 실데이터 기준)
export const mapCenterAtom = atom<{ lat: number; lng: number }>({ lat: 37.2659, lng: 126.9997 });

// 현재 선택된 정류장 (바텀시트에 표시)
export const selectedStopAtom = atom<Stop | null>(null);

// 현재 선택된 노선 (노선 리뷰 패널). fromStop* 은 "이 정류장에서 넘어옴" 컨텍스트 — 노선도 하이라이트용.
export type SelectedRoute = {
  id: string;
  name: string;
  region: Region;
  fromStopId?: string;
  fromStopName?: string;
};
export const selectedRouteAtom = atom<SelectedRoute | null>(null);

// 지도에서 클릭한 버스 (노선도에서 하이라이트/스크롤용)
export const selectedBusIdAtom = atom<string | null>(null);
