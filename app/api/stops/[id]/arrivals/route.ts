import { NextResponse, type NextRequest } from "next/server";

import { getArrivals } from "@/lib/bus";

// Next.js 15: 동적 라우트의 params 는 Promise 다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const arrivals = await getArrivals(id);
  return NextResponse.json({ arrivals });
}
