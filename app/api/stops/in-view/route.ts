import { type NextRequest } from "next/server";

import { streamStopsInBounds } from "@/lib/bus";

// 공공 API CORS 회피 + 셀 격자 조회를 서버에서 수행.
// 중심 셀부터 완료되는 대로 NDJSON(한 줄 = 셀 하나의 정류소 배열)으로 스트리밍.
// 실패한 셀이 있으면 마지막에 요약 한 줄({"failed":n,"total":m}, 배열이 아닌 객체)을 붙인다.
// 공공 API 가 실패해도 응답은 200 이라, 이 줄이 없으면 클라이언트는 '정류소 없음'과 '조회 실패'를 구분할 수 없다.
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  // Number(null)·Number("") 는 0 이라 빠진 좌표가 적도·본초 자오선으로 읽힌다. 네 값이 모두 있어야 하고,
  // 위도·경도 범위 안이며 sw 가 ne 보다 작아야 한다 (지도는 이 형식으로만 보낸다). NaN·Infinity 는 범위 비교에서 걸린다.
  const raw = ["swLat", "swLng", "neLat", "neLng"].map((k) => p.get(k)?.trim() ?? "");
  const [swLat, swLng, neLat, neLng] = raw.map(Number);
  const valid =
    raw.every((v) => v !== "") &&
    Math.abs(swLat) <= 90 &&
    Math.abs(neLat) <= 90 &&
    Math.abs(swLng) <= 180 &&
    Math.abs(neLng) <= 180 &&
    swLat <= neLat &&
    swLng <= neLng;
  if (!valid) {
    return new Response("", { headers: { "content-type": "application/x-ndjson" } });
  }

  // 클라이언트가 끊으면(지도를 옮겨 이전 요청 취소) 남은 셀은 조회하지 않는다.
  // 끊김은 응답 스트림 취소(cancel)나 요청의 signal 로 전해지므로 둘을 컨트롤러 하나로 모은다. 요청이 이미 취소된 채 들어와도 바로 멈춘다.
  // AbortSignal.any 는 원래 signal 을 약하게 잡아, 요청 객체가 GC 되면 끊김이 전해지지 않는다(CI 에서 재현).
  // 그래서 요청 signal 에 직접 리스너를 걸고 스트림이 끝날 때 뗀다. 그동안 req 를 붙잡아 둔다.
  const cancelled = new AbortController();
  const onRequestAbort = () => cancelled.abort();
  if (req.signal.aborted) cancelled.abort();
  else req.signal.addEventListener("abort", onRequestAbort, { once: true });
  const signal = cancelled.signal;

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
        const { failed, total, started } = await streamStopsInBounds(
          { lat: swLat, lng: swLng },
          { lat: neLat, lng: neLng },
          (stops) => send(stops),
          signal,
        );
        if (signal.aborted) {
          console.info(`[api] stops/in-view 클라이언트가 끊어 남은 셀 건너뜀 (셀 ${started}/${total}까지 시작)`);
        } else if (failed > 0) {
          send({ failed, total });
        }
      } catch (e) {
        console.error("[api] stops/in-view 실패:", e);
        send({ failed: 1, total: 1 });
      } finally {
        req.signal.removeEventListener("abort", onRequestAbort);
        try {
          controller.close();
        } catch {
          /* 이미 끊긴 스트림 */
        }
      }
    },
    cancel() {
      cancelled.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
