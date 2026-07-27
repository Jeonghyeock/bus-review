// 서울/경기 등 provider 마다 응답 스키마가 다르므로, 어댑터에서 아래 공통 타입으로 정규화한다.

export type Region = "seoul" | "gyeonggi";

export type Stop = {
  id: string;
  region: Region;
  name: string;
  lat: number;
  lng: number;
  routeIds?: string[];
};

export type BusRoute = {
  id: string;
  region: Region;
  name: string; // 노선번호/명 (예: 간선 146)
  type?: string; // 간선/지선/광역/직행 등
};

export type Arrival = {
  routeId: string;
  routeName: string;
  predictMinutes: number; // N분 후 도착
  remainStops?: number; // 몇 정거장 전
  message?: string; // 원본 도착 메시지 (예: "3분5초후[2번째 전]", "곧 도착", "운행종료")
  isLast?: boolean;
};

// 리뷰 대상: 노선 또는 정류장
export type ReviewTargetType = "route" | "stop";
