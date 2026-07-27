import { NextResponse, type NextRequest } from "next/server";

import { getStopsNearby } from "@/lib/bus";

// 공공 API 는 브라우저 CORS 를 막으므로 이 서버 라우트를 경유한다 (API 키도 서버에 숨김).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") ?? "37.4979");
  const lng = Number(searchParams.get("lng") ?? "127.0276");
  const radius = Number(searchParams.get("radius") ?? "500");

  const stops = await getStopsNearby(lat, lng, radius);
  return NextResponse.json({ stops });
}
