import { atom } from "jotai";

import type { Stop } from "@/lib/bus/types";

// 지도 중심 (기본: 강남역)
export const mapCenterAtom = atom<{ lat: number; lng: number }>({ lat: 37.4979, lng: 127.0276 });

// 현재 선택된 정류장 (바텀시트에 표시)
export const selectedStopAtom = atom<Stop | null>(null);
