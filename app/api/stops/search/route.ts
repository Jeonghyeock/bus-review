import { NextResponse, type NextRequest } from "next/server";

import { searchStops } from "@/lib/bus";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ stops: [] });
  try {
    return NextResponse.json({ stops: await searchStops(q) });
  } catch (e) {
    console.error("[api] stops/search 실패:", e);
    // 200 + 빈 배열이면 클라이언트가 '결과 없음'과 구분하지 못하므로 502 로 알린다
    return NextResponse.json({ error: "정류소 검색 실패" }, { status: 502 });
  }
}
