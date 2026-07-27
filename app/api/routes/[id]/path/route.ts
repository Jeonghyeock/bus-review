import { NextResponse, type NextRequest } from "next/server";

import { getRoutePath } from "@/lib/bus";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = await getRoutePath(id);
  return NextResponse.json({ path });
}
