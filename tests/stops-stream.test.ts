import { afterEach, describe, expect, it, vi } from "vitest";

// /api/stops/in-view 가 공공 API(GBIS) 실패를 스트림 끝 요약 줄로 알리는지 검증한다.
// 공공 API 는 fetch 를 가짜로 바꿔 흉내 내고, 모듈이 읽는 환경 변수·셀 캐시가 테스트끼리 섞이지 않게 매번 다시 불러온다.

const URL_ = "http://localhost/api/stops/in-view?swLat=37.2600&swLng=127.0000&neLat=37.2700&neLng=127.0100";

const station = (id: string) =>
  new Response(
    JSON.stringify({
      response: { msgBody: { busStationAroundList: [{ stationId: id, stationName: "정류소", x: 127.001, y: 37.261, mobileNo: "01" }] } },
    }),
  );

async function callRoute(fetchImpl: (n: number) => Response, mock = false) {
  vi.resetModules();
  vi.stubEnv("BUS_USE_MOCK", mock ? "true" : "false");
  vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
  let calls = 0;
  vi.stubGlobal("fetch", vi.fn(async () => fetchImpl(calls++)));
  const { GET } = await import("@/app/api/stops/in-view/route");
  const res = await GET(new Request(URL_) as never);
  const lines = (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as unknown);
  return { status: res.status, lines, calls };
}

const stopLines = (lines: unknown[]) => lines.filter((l) => Array.isArray(l));
const summaryLines = (lines: unknown[]) => lines.filter((l) => !Array.isArray(l));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/stops/in-view", () => {
  it("공공 API 가 모든 셀에서 실패하면 200 이지만 끝에 실패 요약 줄을 붙인다", async () => {
    const { status, lines, calls } = await callRoute(() => new Response("", { status: 500 }));
    expect(status).toBe(200);
    expect(calls).toBeGreaterThan(1);
    expect(stopLines(lines)).toEqual([]);
    expect(summaryLines(lines)).toEqual([{ failed: calls, total: calls }]);
  });

  it("일부 셀만 실패하면 받은 정류소와 함께 실패한 셀 수를 알린다", async () => {
    const { lines, calls } = await callRoute((n) => (n === 0 ? new Response("", { status: 500 }) : station(`s${n}`)));
    expect(stopLines(lines)).toHaveLength(calls - 1);
    expect(summaryLines(lines)).toEqual([{ failed: 1, total: calls }]);
  });

  it("모두 성공하면 요약 줄 없이 정류소만 보낸다", async () => {
    const { lines, calls } = await callRoute((n) => station(`s${n}`));
    expect(stopLines(lines)).toHaveLength(calls);
    expect(summaryLines(lines)).toEqual([]);
  });

  it("목업 모드에서는 공공 API 를 부르지 않고 요약 줄도 없다", async () => {
    const { lines, calls } = await callRoute(() => new Response("", { status: 500 }), true);
    expect(calls).toBe(0);
    expect(stopLines(lines)).toHaveLength(1);
    expect(summaryLines(lines)).toEqual([]);
  });
});
