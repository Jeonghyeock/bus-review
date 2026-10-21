import { NextResponse, type NextRequest } from "next/server";

import { getRouteStations } from "@/lib/bus";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const stations = await getRouteStations(id);
    return NextResponse.json({ stations });
  } catch (e) {
    console.error("[api] route stations 실패:", e);
    // 200 + 빈 배열이면 클라이언트가 빈 노선도를 계속 캐시하므로(staleTime: Infinity) 502 로 알린다
    return NextResponse.json({ error: "노선 정류소 조회 실패" }, { status: 502 });
  }
}
