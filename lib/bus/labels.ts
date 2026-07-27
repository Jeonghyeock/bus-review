// GBIS 코드 → 표시용 라벨 (순수 상수)

export const CROWDED_LABEL: Record<number, string> = {
  1: "여유",
  2: "보통",
  3: "혼잡",
  4: "매우혼잡",
};

export const CROWDED_COLOR: Record<number, string> = {
  1: "#16a34a",
  2: "#0891b2",
  3: "#ea580c",
  4: "#dc2626",
};

// routeTypeCd → 짧은 유형명
export const ROUTE_TYPE: Record<number, string> = {
  11: "직행좌석",
  12: "좌석",
  13: "일반",
  14: "광역급행",
  15: "따복",
  16: "경기순환",
  21: "직행좌석(농어촌)",
  22: "좌석(농어촌)",
  23: "일반(농어촌)",
  30: "마을",
  41: "고속시외",
  42: "좌석시외",
  43: "일반시외",
  51: "리무진공항",
  52: "좌석공항",
  53: "일반공항",
};
