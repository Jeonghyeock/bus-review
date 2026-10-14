import { type NextRequest } from "next/server";

import { streamStopsInBounds } from "@/lib/bus";

// 공공 API CORS 회피 + 셀 격자 조회를 서버에서 수행.
// 중심 셀부터 완료되는 대로 NDJSON(한 줄 = 셀 하나의 정류소 배열)으로 스트리밍.
// 실패한 셀이 있으면 마지막에 요약 한 줄({"failed":n,"total":m}, 배열이 아닌 객체)을 붙인다.
// 공공 API 가 실패해도 응답은 200 이라, 이 줄이 없으면 클라이언트는 '정류소 없음'과 '조회 실패'를 구분할 수 없다.
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const swLat = Number(p.get("swLat"));
  const swLng = Number(p.get("swLng"));
  const neLat = Number(p.get("neLat"));
  const neLng = Number(p.get("neLng"));
  if ([swLat, swLng, neLat, neLng].some((n) => !Number.isFinite(n))) {
    return new Response("", { headers: { "content-type": "application/x-ndjson" } });
  }

  // 클라이언트가 끊으면(지도를 옮겨 이전 요청 취소) 남은 셀 조회와 진행 중인 공공 API 요청을 멈춘다.
  // 끊김은 응답 스트림 취소(cancel)나 요청의 signal 로 전해지므로 둘 다 받는다.
  const abort = new AbortController();
  req.signal?.addEventListener("abort", () => abort.abort(), { once: true });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 클라이언트가 먼저 끊으면(지도를 옮겨 이전 요청 취소) enqueue·close 가 예외를 던지므로 삼킨다
      const send = (value: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(value) + "\n"));
        } catch {
          /* 이미 끊긴 스트림 */
        }
      };
      try {
        const { failed, total, queried } = await streamStopsInBounds(
          { lat: swLat, lng: swLng },
          { lat: neLat, lng: neLng },
          (stops) => send(stops),
          abort.signal,
        );
        if (abort.signal.aborted) {
          console.info(`[api] stops/in-view 클라이언트가 끊어 중단 (셀 ${queried}/${total} 조회)`);
        } else if (failed > 0) {
          send({ failed, total });
        }
      } catch (e) {
        console.error("[api] stops/in-view 실패:", e);
        send({ failed: 1, total: 1 });
      } finally {
        try {
          controller.close();
        } catch {
          /* 이미 끊긴 스트림 */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
