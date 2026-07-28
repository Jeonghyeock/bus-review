import { NextResponse, type NextRequest } from "next/server";

import { getRouteStations } from "@/lib/bus";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const stations = await getRouteStations(id);
    return NextResponse.json({ stations });
  } catch (e) {
    console.error("[api] route stations 실패:", e);
    return NextResponse.json({ stations: [] });
  }
}
