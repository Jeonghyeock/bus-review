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

// 셀 24칸(상한)이 나오는 넓은 영역 — 동시 실행 수(6)보다 칸이 많아야 취소 효과를 볼 수 있다
const WIDE = "http://localhost/api/stops/in-view?swLat=37.2400&swLng=126.9800&neLat=37.2800&neLng=127.0300";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// 응답에 50ms 걸리는 공공 API (부른 횟수를 센다)
function slowGbis() {
  const state = { calls: 0 };
  const impl = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        const n = state.calls++;
        setTimeout(() => resolve(station(`s${n}`)), 50);
      }),
  );
  return Object.assign(state, { impl });
}

async function readAll(res: Response) {
  return (await res.text()).split("\n").filter(Boolean);
}

async function loadRoute(fetchImpl: (...args: never[]) => Promise<Response>, mock = false) {
  vi.resetModules();
  vi.stubEnv("BUS_USE_MOCK", mock ? "true" : "false");
  vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
  vi.stubGlobal("fetch", fetchImpl);
  const { GET } = await import("@/app/api/stops/in-view/route");
  return GET;
}

async function callRoute(fetchImpl: (n: number) => Response, mock = false) {
  let calls = 0;
  const GET = await loadRoute(vi.fn(async () => fetchImpl(calls++)), mock);
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

  it("클라이언트가 응답 스트림을 끊으면 남은 셀은 조회하지 않는다", async () => {
    const gbis = slowGbis();
    const GET = await loadRoute(gbis.impl);
    const reader = (await GET(new Request(WIDE) as never)).body!.getReader();
    await reader.read(); // 가운데 셀 결과 한 줄을 받은 뒤
    await reader.cancel(); // 지도를 옮겨 이전 요청을 취소한 것처럼 끊는다
    await sleep(400); // 멈추지 않았다면 24칸을 다 부를 시간
    expect(gbis.calls).toBeLessThanOrEqual(12); // 처음 동시에 시작한 6칸 + 첫 응답 무렵 이어서 시작한 몇 칸
  });

  it("끊긴 요청에서 이미 시작한 셀은 끝까지 받아 캐시에 남기므로, 같은 영역을 다시 열면 칸마다 한 번씩만 부른다", async () => {
    const gbis = slowGbis();
    const GET = await loadRoute(gbis.impl);
    const reader = (await GET(new Request(WIDE) as never)).body!.getReader();
    await reader.read();
    await reader.cancel();
    await sleep(400); // 진행 중이던 셀이 끝나 캐시에 들어갈 시간
    const first = gbis.calls;

    const lines = await readAll(await GET(new Request(WIDE) as never)); // 같은 영역을 다시 끝까지
    expect(lines).toHaveLength(24); // 24칸 모두 결과가 옴(캐시 + 새 조회)
    expect(gbis.calls).toBe(24); // 첫 요청에서 부른 칸은 다시 부르지 않음
    expect(first).toBeLessThan(24);
  });

  it("이미 취소된 채 들어온 요청은 공공 API 를 부르지 않는다", async () => {
    const gbis = slowGbis();
    const GET = await loadRoute(gbis.impl);
    const ctrl = new AbortController();
    ctrl.abort();
    await readAll(await GET(new Request(WIDE, { signal: ctrl.signal }) as never));
    expect(gbis.calls).toBe(0);
  });

  it("요청의 signal 이 취소돼도 남은 셀 조회를 멈춘다", async () => {
    const gbis = slowGbis();
    const GET = await loadRoute(gbis.impl);
    const ctrl = new AbortController();
    const reader = (await GET(new Request(WIDE, { signal: ctrl.signal }) as never)).body!.getReader();
    await reader.read();
    ctrl.abort();
    await sleep(400);
    expect(gbis.calls).toBeLessThanOrEqual(12);
  });

  it("취소되면 시작한 셀까지만 처리하고, 실패한 셀로 세지 않는다", async () => {
    const gbis = slowGbis();
    await loadRoute(gbis.impl);
    const { streamGyeonggiStopsInBounds } = await import("@/lib/bus/gyeonggi");
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 70);
    const result = await streamGyeonggiStopsInBounds(
      { lat: 37.24, lng: 126.98 },
      { lat: 37.28, lng: 127.03 },
      () => {},
      ctrl.signal,
    );
    expect(result.failed).toBe(0);
    expect(result.started).toBeLessThan(result.total);
  });

  it("목업 모드에서는 공공 API 를 부르지 않고 요약 줄도 없다", async () => {
    const { lines, calls } = await callRoute(() => new Response("", { status: 500 }), true);
    expect(calls).toBe(0);
    expect(stopLines(lines)).toHaveLength(1);
    expect(summaryLines(lines)).toEqual([]);
  });
});
