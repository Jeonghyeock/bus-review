import { NextResponse, type NextRequest } from "next/server";

import { getBusPositions } from "@/lib/bus";

// 노선의 실시간 버스 위치 (Next.js 15: params 는 Promise)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const buses = await getBusPositions(id);
  return NextResponse.json({ buses });
}
