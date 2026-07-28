import { NextResponse, type NextRequest } from "next/server";

import { searchStops } from "@/lib/bus";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ stops: [] });
  try {
    return NextResponse.json({ stops: await searchStops(q) });
  } catch (e) {
    console.error("[api] stops/search 실패:", e);
    return NextResponse.json({ stops: [] });
  }
}
