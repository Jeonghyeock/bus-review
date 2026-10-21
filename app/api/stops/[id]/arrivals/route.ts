import { NextResponse, type NextRequest } from "next/server";

import { getArrivals } from "@/lib/bus";

// Next.js 15: 동적 라우트의 params 는 Promise 다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const arrivals = await getArrivals(id);
    return NextResponse.json({ arrivals });
  } catch (e) {
    console.error("[api] arrivals 실패:", e);
    // 200 + 빈 배열이면 클라이언트가 '도착 예정 없음'과 구분하지 못하므로 502 로 알린다
    return NextResponse.json({ error: "도착정보 조회 실패" }, { status: 502 });
  }
}
