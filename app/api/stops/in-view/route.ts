import { NextResponse, type NextRequest } from "next/server";

import { getStopsInBounds } from "@/lib/bus";

// 공공 API CORS 회피 + 셀 격자 조회를 서버에서 수행
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const swLat = Number(p.get("swLat"));
  const swLng = Number(p.get("swLng"));
  const neLat = Number(p.get("neLat"));
  const neLng = Number(p.get("neLng"));
  if ([swLat, swLng, neLat, neLng].some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ stops: [] });
  }
  try {
    const stops = await getStopsInBounds({ lat: swLat, lng: swLng }, { lat: neLat, lng: neLng });
    return NextResponse.json({ stops });
  } catch (e) {
    console.error("[api] stops/in-view 실패:", e);
    return NextResponse.json({ stops: [] });
  }
}
