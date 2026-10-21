import { afterEach, describe, expect, it, vi } from "vitest";

// 노선 버스 위치를 처음 열 때(정류소 좌표 캐시가 빔) 버스마다 나가는 정류소 조회를 동시 6개로 제한하는지 검증한다.
// 한꺼번에 수십 개를 보내면 GBIS 가 429 로 거절해 그 버스들이 지도에서 빠진다.
// 공공 API 는 fetch 를 가짜로 바꿔 흉내 내고, 좌표 캐시가 테스트끼리 섞이지 않게 모듈을 다시 불러온다.

const gbisOk = (msgBody: unknown) =>
  new Response(JSON.stringify({ response: { msgHeader: { resultCode: 0 }, msgBody } }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getGyeonggiBusPositions", () => {
  it("버스 20대의 정류소 좌표 조회를 동시 6개까지만 보내고, 20대 모두 버스 순서대로 돌려준다", async () => {
    // 정류소가 모두 달라야 캐시에 가리지 않고 버스마다 조회가 나간다
    const buses = Array.from({ length: 20 }, (_, i) => ({
      vehId: `v${i}`,
      plateNo: `경기70바${1000 + i}`,
      stationId: `${i}`,
      stationSeq: i + 1,
    }));
    const state = { stationCalls: 0, inFlight: 0, maxInFlight: 0 };

    vi.resetModules();
    vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = new URL(url);
        if (u.pathname.endsWith("/getBusLocationListv2")) return gbisOk({ busLocationList: buses });
        // 정류소 조회(busStationInfov2): 응답에 20ms 걸리고, 동시에 몇 개가 진행 중인지 센다
        state.stationCalls++;
        state.inFlight++;
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
        await new Promise((r) => setTimeout(r, 20));
        state.inFlight--;
        const i = Number(u.searchParams.get("stationId"));
        return gbisOk({ busStationInfo: { x: 127 + i / 1000, y: 37 + i / 1000 } });
      }),
    );
    const { getGyeonggiBusPositions } = await import("@/lib/bus/gyeonggi");

    const positions = await getGyeonggiBusPositions("200000001");
    expect(state.stationCalls).toBe(20);
    expect(state.maxInFlight).toBe(6);
    expect(positions.map((b) => b.id)).toEqual(buses.map((b) => b.vehId));
    expect(positions.map((b) => b.lat)).toEqual(buses.map((_, i) => 37 + i / 1000));
  });
});
