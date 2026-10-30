import { afterEach, describe, expect, it, vi } from "vitest";

// /api/stops/in-view 가 공공 API(GBIS) 실패를 스트림 끝 요약 줄로 알리는지 검증한다.
// 공공 API 는 fetch 를 가짜로 바꿔 흉내 내고, 모듈이 읽는 환경 변수·셀 캐시가 테스트끼리 섞이지 않게 매번 다시 불러온다.

const URL_ = "http://localhost/api/stops/in-view?swLat=37.2600&swLng=127.0000&neLat=37.2700&neLng=127.0100";

const station = (id: string) =>
  new Response(
    JSON.stringify({
      response: {
        msgHeader: { resultCode: 0 },
        msgBody: { busStationAroundList: [{ stationId: id, stationName: "정류소", x: 127.001, y: 37.261, mobileNo: "01" }] },
      },
    }),
  );

// GBIS 는 오류·결과 없음도 HTTP 200 으로 보내고 msgHeader.resultCode 로 알린다 (msgBody 없음)
const gbisCode = (resultCode: number, resultMessage: string) =>
  new Response(JSON.stringify({ response: { comMsgHeader: "", msgHeader: { resultCode, resultMessage } } }));

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

  it("200 이어도 resultCode 가 오류(8 요청 제한 초과)면 실패한 셀로 세고, 캐시하지 않아 다시 열면 또 부른다", async () => {
    let calls = 0;
    const GET = await loadRoute(
      vi.fn(async () => {
        calls++;
        return gbisCode(8, "요청 제한 초과");
      }),
    );
    const lines = (await readAll(await GET(new Request(URL_) as never))).map((l) => JSON.parse(l) as unknown);
    const first = calls;
    expect(first).toBeGreaterThan(1);
    expect(lines).toEqual([{ failed: first, total: first }]);

    await readAll(await GET(new Request(URL_) as never)); // 같은 영역을 다시 열면
    expect(calls).toBe(first * 2); // 칸마다 다시 부른다
  });

  it("resultCode 4(결과 없음)는 실패가 아니라 정류소 없음이고, 캐시해 다시 부르지 않는다", async () => {
    let calls = 0;
    const GET = await loadRoute(
      vi.fn(async () => {
        calls++;
        return gbisCode(4, "결과가 존재하지 않습니다.");
      }),
    );
    const lines = await readAll(await GET(new Request(URL_) as never));
    const first = calls;
    expect(first).toBeGreaterThan(1);
    expect(lines).toEqual([]); // 정류소 줄도, 실패 요약 줄도 없음

    await readAll(await GET(new Request(URL_) as never));
    expect(calls).toBe(first);
  });

  it("200 이어도 공공데이터포털 게이트웨이 오류(OpenAPI_ServiceResponse)면 실패한 셀로 센다", async () => {
    const gateway =
      "<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>" +
      "<returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode>" +
      "</cmmMsgHeader></OpenAPI_ServiceResponse>";
    const { lines, calls } = await callRoute(() => new Response(gateway));
    expect(stopLines(lines)).toEqual([]);
    expect(summaryLines(lines)).toEqual([{ failed: calls, total: calls }]);
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

  it("영역이 아주 넓어도(40°×40°) 중심 24칸만 조회한다", async () => {
    // 고치기 전에는 격자 전체(약 4,400만 칸)를 배열로 만들고 정렬한 뒤에야 24칸으로 잘라, 힙이 넘쳐 프로세스가 죽었다
    let calls = 0;
    const GET = await loadRoute(vi.fn(async () => station(`s${calls++}`)));
    const lines = await readAll(
      await GET(new Request("http://localhost/api/stops/in-view?swLat=0&swLng=100&neLat=40&neLng=140") as never),
    );
    expect(calls).toBe(24);
    expect(lines).toHaveLength(24);
  });

  it.each([
    ["좌표가 빠지면", "neLat=37.27&neLng=127.01"],
    ["좌표가 비어 있으면", "swLat=&swLng=127.00&neLat=37.27&neLng=127.01"],
    ["좌표가 공백뿐이면", "swLat=%20&swLng=127.00&neLat=37.27&neLng=127.01"],
    ["숫자가 아니면", "swLat=abc&swLng=127.00&neLat=37.27&neLng=127.01"],
    ["위도만 sw 가 ne 보다 크면", "swLat=37.27&swLng=127.00&neLat=37.26&neLng=127.01"],
    ["경도만 sw 가 ne 보다 크면", "swLat=37.26&swLng=127.01&neLat=37.27&neLng=127.00"],
    ["위도 범위를 넘으면", "swLat=-100&swLng=127.00&neLat=37.27&neLng=127.01"],
    ["경도 범위를 넘으면", "swLat=37.26&swLng=127.00&neLat=37.27&neLng=181"],
  ])("%s 공공 API 를 부르지 않고 빈 응답을 보낸다", async (_, query) => {
    // 빠진 값을 Number(null)=0 으로 읽으면 (0,0)~(37,127) 이 되어 격자가 1억 칸을 넘었다
    let calls = 0;
    const GET = await loadRoute(vi.fn(async () => station(`s${calls++}`)));
    const res = await GET(new Request(`http://localhost/api/stops/in-view?${query}`) as never);
    expect(res.status).toBe(200);
    expect(await readAll(res)).toEqual([]);
    expect(calls).toBe(0);
  });
});

describe("cellsInBounds", () => {
  const CELL = 0.006;
  // 고치기 전 방식: 격자 전체를 만들어 중심에서 가까운 순으로 정렬한 뒤 24칸으로 자른다
  function reference(sw: { lat: number; lng: number }, ne: { lat: number; lng: number }) {
    const cells: Array<[number, number]> = [];
    for (let la = Math.floor(sw.lat / CELL); la <= Math.floor(ne.lat / CELL); la++) {
      for (let ln = Math.floor(sw.lng / CELL); ln <= Math.floor(ne.lng / CELL); ln++) {
        cells.push([(la + 0.5) * CELL, (ln + 0.5) * CELL]);
      }
    }
    const cy = (sw.lat + ne.lat) / 2;
    const cx = (sw.lng + ne.lng) / 2;
    const d = ([la, ln]: [number, number]) => (la - cy) ** 2 + (ln - cx) ** 2;
    return cells.sort((a, b) => d(a) - d(b)).slice(0, 24);
  }
  // 고정 시드 난수 — 실행마다 같은 영역을 쓴다
  function rng(seed: number) {
    return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  }

  it("격자 전체를 정렬하는 방식과 같은 칸을 같은 순서로 돌려준다 (가늘고 긴 영역·셀 경계 포함)", async () => {
    const { cellsInBounds } = await import("@/lib/bus/gyeonggi");
    const r = rng(42);
    for (let i = 0; i < 3000; i++) {
      // 셀 경계에 딱 맞는 영역도 섞는다
      const snap = (v: number) => (i % 5 === 0 ? Math.round(v / CELL) * CELL : v);
      const sw = { lat: snap(37 + r()), lng: snap(126.5 + r()) };
      const h = r() < 0.3 ? r() * 0.006 : r() * 0.6; // 한 줄짜리 띠부터 100칸까지
      const w = r() < 0.3 ? r() * 0.006 : r() * 0.6;
      const ne = { lat: snap(sw.lat + h), lng: snap(sw.lng + w) };
      expect(cellsInBounds(sw, ne)).toEqual(reference(sw, ne));
    }
  });

  it("sw 가 ne 보다 크면 빈 목록이다", async () => {
    const { cellsInBounds } = await import("@/lib/bus/gyeonggi");
    expect(cellsInBounds({ lat: 37.28, lng: 127.03 }, { lat: 37.24, lng: 126.98 })).toEqual([]);
    expect(cellsInBounds({ lat: 37.28, lng: 126.98 }, { lat: 37.24, lng: 127.03 })).toEqual([]);
  });
});
