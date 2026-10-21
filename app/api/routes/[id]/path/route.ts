import { NextResponse, type NextRequest } from "next/server";

import { getRoutePath } from "@/lib/bus";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const path = await getRoutePath(id);
    return NextResponse.json({ path });
  } catch (e) {
    console.error("[api] route path 실패:", e);
    // 200 + 빈 배열이면 클라이언트가 빈 경로를 계속 캐시하므로(staleTime: Infinity) 502 로 알린다
    return NextResponse.json({ error: "노선 경로 조회 실패" }, { status: 502 });
  }
}
