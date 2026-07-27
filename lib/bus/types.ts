// 서울/경기 등 provider 마다 응답 스키마가 다르므로, 어댑터에서 아래 공통 타입으로 정규화한다.

export type Region = "seoul" | "gyeonggi";

export type Stop = {
  id: string;
  region: Region;
  name: string;
  lat: number;
  lng: number;
  stationNo?: string; // 정류소 번호(ARS)
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
  routeType?: string; // 노선 유형명 (일반/직행좌석 등)
  destName?: string; // 방면(종점)
  predictMinutes: number; // N분 후 도착
  remainStops?: number; // 몇 정거장 전
  crowded?: number; // 혼잡도 1~4
  lowPlate?: boolean; // 저상버스
  remainSeats?: number; // 빈자리 수 (좌석형만)
  plateNo?: string; // 차량번호
  next?: { predictMinutes: number; remainStops?: number }; // 두 번째 도착 버스
  message?: string; // 도착 정보 없음 등
  isLast?: boolean;
};

// 실시간 버스 위치
export type BusPosition = {
  id: string; // 차량 ID
  lat: number;
  lng: number;
  plateNo?: string;
  crowded?: number; // 혼잡도 1~4
  remainSeats?: number; // 빈자리 수
  lowPlate?: boolean; // 저상버스
};

// 리뷰 대상: 노선 또는 정류장
export type ReviewTargetType = "route" | "stop";
