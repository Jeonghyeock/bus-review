import { afterEach, describe, expect, it, vi } from "vitest";

// 노선 버스 위치의 좌표를 버스마다 정류소 조회로 찾지 않고, 노선 정류소 목록 한 번(캐시)으로 찾는지 검증한다.
// 버스마다 조회하면 그 조회가 실패(429 등)한 버스가 200 응답에서 조용히 빠지고, 모두 실패하면 버스가 전부 사라졌다.
// 공공 API 는 fetch 를 가짜로 바꿔 흉내 내고, 캐시가 테스트끼리 섞이지 않게 모듈을 다시 불러온다.

const gbisOk = (msgBody: unknown) =>
  new Response(JSON.stringify({ response: { msgHeader: { resultCode: 0 }, msgBody } }));

// 정류소 0~19 가 있는 노선, 버스 20대(버스 i 는 정류소 i)
const STATIONS = Array.from({ length: 20 }, (_, i) => ({
  stationId: `${i}`,
  stationName: `정류소${i}`,
  stationSeq: i + 1,
  x: 127 + i / 1000,
  y: 37 + i / 1000,
}));
const BUSES = Array.from({ length: 20 }, (_, i) => ({
  vehId: `v${i}`,
  plateNo: `경기70바${1000 + i}`,
  stationId: `${i}`,
  stationSeq: i + 1,
}));

async function load(opts: { stations?: () => Response; buses?: unknown[] } = {}) {
  const calls = { buses: 0, stations: 0, other: 0 };
  vi.resetModules();
  vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
  vi.stubEnv("BUS_USE_MOCK", "false");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.endsWith("/getBusLocationListv2")) {
        calls.buses++;
        return gbisOk({ busLocationList: opts.buses ?? BUSES });
      }
      if (path.endsWith("/getBusRouteStationListv2")) {
        calls.stations++;
        return opts.stations ? opts.stations() : gbisOk({ busRouteStationList: STATIONS });
      }
      calls.other++; // 정류소 하나씩 조회(busStationInfov2) 등 — 나가면 안 된다
      return new Response("", { status: 500 });
    }),
  );
  const { getGyeonggiBusPositions } = await import("@/lib/bus/gyeonggi");
  return { getGyeonggiBusPositions, calls };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getGyeonggiBusPositions", () => {
  it("버스 20대의 좌표를 노선 정류소 목록 한 번으로 찾아, 버스 순서대로 돌려준다", async () => {
    const { getGyeonggiBusPositions, calls } = await load();
    const positions = await getGyeonggiBusPositions("200000001");
    expect(calls).toEqual({ buses: 1, stations: 1, other: 0 });
    expect(positions.map((b) => b.id)).toEqual(BUSES.map((b) => b.vehId));
    expect(positions.map((b) => b.lat)).toEqual(BUSES.map((_, i) => 37 + i / 1000));
  });

  it("노선 정류소 목록은 캐시해, 다음 폴링에서는 버스 위치만 부른다", async () => {
    const { getGyeonggiBusPositions, calls } = await load();
    await getGyeonggiBusPositions("r1");
    await getGyeonggiBusPositions("r1");
    expect(calls).toEqual({ buses: 2, stations: 1, other: 0 });
  });

  it("노선 정류소 목록 조회가 실패하면 던지고(라우트는 502), 실패는 캐시하지 않아 다음에 다시 부른다", async () => {
    let fail = true;
    const { getGyeonggiBusPositions, calls } = await load({
      stations: () => (fail ? new Response("", { status: 503 }) : gbisOk({ busRouteStationList: STATIONS })),
    });
    await expect(getGyeonggiBusPositions("r1")).rejects.toThrow(/503/);
    fail = false;
    expect(await getGyeonggiBusPositions("r1")).toHaveLength(20);
    expect(calls.stations).toBe(2);
  });

  it("노선 정류소 목록에 없는 정류소에 있는 버스만 건너뛴다", async () => {
    const buses = [...BUSES.slice(0, 2), { vehId: "vx", plateNo: "경기70바9999", stationId: "999", stationSeq: 99 }];
    const { getGyeonggiBusPositions } = await load({ buses });
    expect((await getGyeonggiBusPositions("r1")).map((b) => b.id)).toEqual(["v0", "v1"]);
  });

  it("라우트: 노선 정류소 목록 조회가 실패하면 502", async () => {
    await load({ stations: () => new Response("", { status: 500 }) });
    const { GET } = await import("@/app/api/routes/[id]/buses/route");
    const res = await GET(new Request("http://localhost/api/routes/r1/buses") as never, {
      params: Promise.resolve({ id: "r1" }),
    });
    expect(res.status).toBe(502);
  });
});
