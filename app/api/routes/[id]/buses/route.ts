import { NextResponse, type NextRequest } from "next/server";

import { getBusPositions } from "@/lib/bus";

// 노선의 실시간 버스 위치 (Next.js 15: params 는 Promise)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const buses = await getBusPositions(id);
    return NextResponse.json({ buses });
  } catch (e) {
    console.error("[api] buses 실패:", e);
    // 200 + 빈 배열이면 클라이언트가 버스를 모두 지우므로 502 로 알린다(클라이언트는 이전 위치를 유지)
    return NextResponse.json({ error: "버스 위치 조회 실패" }, { status: 502 });
  }
}
