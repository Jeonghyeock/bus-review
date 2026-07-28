import { type NextRequest } from "next/server";

import { streamStopsInBounds } from "@/lib/bus";

// 공공 API CORS 회피 + 셀 격자 조회를 서버에서 수행.
// 중심 셀부터 완료되는 대로 NDJSON(한 줄 = 셀 하나의 정류소 배열)으로 스트리밍.
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const swLat = Number(p.get("swLat"));
  const swLng = Number(p.get("swLng"));
  const neLat = Number(p.get("neLat"));
  const neLng = Number(p.get("neLng"));
  if ([swLat, swLng, neLat, neLng].some((n) => !Number.isFinite(n))) {
    return new Response("", { headers: { "content-type": "application/x-ndjson" } });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await streamStopsInBounds(
          { lat: swLat, lng: swLng },
          { lat: neLat, lng: neLng },
          (stops) => controller.enqueue(enc.encode(JSON.stringify(stops) + "\n")),
        );
      } catch (e) {
        console.error("[api] stops/in-view 실패:", e);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
