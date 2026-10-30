import { NextResponse, type NextRequest } from "next/server";

import { getArrivals } from "@/lib/bus";

// 성공 응답은 CDN(Vercel)이 15초 동안 정류장마다 공유하고, 그 뒤 15초는 지난 값을 주면서 뒤에서 새로 받는다.
// 같은 정류장을 여러 사람·탭이 30초마다 폴링해도 공공 API 는 정류장마다 15초에 한 번 꼴로만 불린다(DESIGN §10).
// 서버 메모리 캐시는 Vercel 에서 인스턴스마다 따로 있고 콜드 스타트 때 비워져 CDN 캐시를 쓴다. 502 는 캐시하지 않는다.
const CACHE_CONTROL = "public, s-maxage=15, stale-while-revalidate=15";

// Next.js 15: 동적 라우트의 params 는 Promise 다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const arrivals = await getArrivals(id);
    return NextResponse.json({ arrivals }, { headers: { "cache-control": CACHE_CONTROL } });
  } catch (e) {
    console.error("[api] arrivals 실패:", e);
    // 200 + 빈 배열이면 클라이언트가 '도착 예정 없음'과 구분하지 못하므로 502 로 알린다
    return NextResponse.json({ error: "도착정보 조회 실패" }, { status: 502 });
  }
}
