import { afterEach, describe, expect, it, vi } from "vitest";

// 도착 정보 라우트가 성공 응답만 CDN 캐시(s-maxage)를 허용하는지 검증한다.
// CDN 이 실제로 공유하는지는 배포 환경(Vercel)에서만 확인할 수 있어, 여기서는 헤더만 본다.

async function callArrivals(response: () => Response) {
  vi.resetModules();
  vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
  vi.stubEnv("BUS_USE_MOCK", "false");
  vi.stubGlobal("fetch", vi.fn(async () => response()));
  const { GET } = await import("@/app/api/stops/[id]/arrivals/route");
  return GET(new Request("http://localhost/api/stops/s1/arrivals") as never, {
    params: Promise.resolve({ id: "s1" }),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/stops/[id]/arrivals 캐시 헤더", () => {
  it("성공하면 CDN 이 15초 공유하고 다음 15초는 지난 값을 주며 새로 받게 한다", async () => {
    const res = await callArrivals(
      () =>
        new Response(
          JSON.stringify({
            response: {
              msgHeader: { resultCode: 0 },
              msgBody: { busArrivalList: [{ routeId: "r1", routeName: "10", routeTypeCd: 13, predictTime1: 3 }] },
            },
          }),
        ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, s-maxage=15, stale-while-revalidate=15");
  });

  it("실패(502)는 캐시를 허용하지 않는다", async () => {
    const res = await callArrivals(() => new Response("", { status: 500 }));
    expect(res.status).toBe(502);
    expect(res.headers.get("cache-control") ?? "").not.toMatch(/s-maxage|public/);
  });
});
