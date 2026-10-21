import { afterEach, expect, it, vi } from "vitest";

// /api/stops/in-view 가 요청의 signal 취소를 받는지, 요청 객체가 GC 된 뒤에도 확인한다.
// AbortSignal.any 로 묶으면 원래 signal 을 약하게 잡아, 요청 객체가 GC 되면 취소가 전해지지 않았다(CI 에서 24칸을 다 부름).
// 공공 API 응답은 테스트가 직접 하나씩 풀어 준다. 시간에 기대지 않으므로 느린 CI 에서도 결과가 같다.

const WIDE = "http://localhost/api/stops/in-view?swLat=37.2400&swLng=126.9800&neLat=37.2800&neLng=127.0300";
const tick = () => new Promise((r) => setTimeout(r, 1));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("요청 객체가 GC 돼도 signal 취소가 전해져, 취소한 뒤로는 새 셀을 조회하지 않는다", async () => {
  const gc = (globalThis as { gc?: () => void }).gc;
  expect(gc, "vitest.config 의 --expose-gc 가 필요하다").toBeTypeOf("function");

  let calls = 0;
  const pending: Array<() => void> = [];
  vi.resetModules();
  vi.stubEnv("BUS_USE_MOCK", "false");
  vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          const n = calls++;
          const body = {
            response: {
              msgHeader: { resultCode: 0 },
              msgBody: { busStationAroundList: [{ stationId: `s${n}`, stationName: "정류소", x: 127.001, y: 37.261 }] },
            },
          };
          pending.push(() => resolve(new Response(JSON.stringify(body))));
        }),
    ),
  );
  const { GET } = await import("@/app/api/stops/in-view/route");

  const ctrl = new AbortController();
  // 요청 객체를 변수에 두지 않아, 응답을 받은 뒤에는 GC 될 수 있게 한다
  const reader = (await GET(new Request(WIDE, { signal: ctrl.signal }) as never)).body!.getReader();
  pending.shift()!(); // 가운데 셀 하나만 끝내고
  await reader.read(); // 그 결과 한 줄을 받는다
  for (let i = 0; i < 5; i++) {
    gc!();
    await tick();
  }

  const atAbort = calls;
  ctrl.abort();
  // 남은 응답을 모두 끝낸다. 취소가 전해졌다면 여기서 새 조회가 생기지 않는다
  for (let i = 0; i < 100 && pending.length; i++) {
    pending.shift()!();
    await tick();
  }
  expect(atAbort).toBeLessThan(24);
  expect(calls).toBe(atAbort);
});
