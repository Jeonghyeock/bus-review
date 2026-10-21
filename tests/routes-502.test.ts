import { afterEach, describe, expect, it, vi } from "vitest";

// 도착·버스 위치·노선 경로·노선 정류소·검색 라우트가 공공 API(GBIS) 실패를 502 로 알리는지 검증한다.
// 200 + 빈 배열로 숨기면 클라이언트 훅이 실패로 받지 못해 오류 안내가 뜨지 않고,
// staleTime: Infinity 인 노선 경로·정류소는 빈 결과가 그대로 캐시에 남는다.
// 공공 API 는 fetch 를 가짜로 바꿔 흉내 내고, 모듈이 읽는 환경 변수가 테스트끼리 섞이지 않게 매번 다시 불러온다.

type IdRoute = {
  GET: (req: never, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
};

const arrivals = () => import("@/app/api/stops/[id]/arrivals/route");
const buses = () => import("@/app/api/routes/[id]/buses/route");
const path = () => import("@/app/api/routes/[id]/path/route");
const stations = () => import("@/app/api/routes/[id]/stations/route");

const gbisFail = () => new Response("", { status: 500 });
const gbisOk = (msgBody: unknown) =>
  new Response(JSON.stringify({ response: { msgHeader: { resultCode: 0 }, msgBody } }));

async function load<M>(importRoute: () => Promise<M>, fetchImpl: () => Response): Promise<M> {
  vi.resetModules();
  vi.stubEnv("BUS_USE_MOCK", "false");
  vi.stubEnv("GYEONGGI_BUS_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn(async () => fetchImpl()));
  return importRoute();
}

async function callById(importRoute: () => Promise<IdRoute>, fetchImpl: () => Response) {
  const { GET } = await load(importRoute, fetchImpl);
  const res = await GET(new Request("http://localhost/api") as never, { params: Promise.resolve({ id: "200000001" }) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("공공 API 실패를 502 로 알리는 라우트", () => {
  it.each([
    ["도착 정보", arrivals],
    ["버스 위치", buses],
    ["노선 경로", path],
    ["노선 정류소", stations],
  ])("%s: GBIS 가 실패하면 빈 배열 대신 502 와 오류 메시지를 보낸다", async (_, route) => {
    const { status, body } = await callById(route, gbisFail);
    expect(status).toBe(502);
    expect(body).toEqual({ error: expect.any(String) });
  });

  it("정류소 검색: GBIS 가 실패하면 502", async () => {
    const { GET } = await load(() => import("@/app/api/stops/search/route"), gbisFail);
    const res = await GET(new Request("http://localhost/api/stops/search?q=수원역") as never);
    expect(res.status).toBe(502);
  });

  it("도착 정보: GBIS 가 성공하면 200 과 도착 목록", async () => {
    const { status, body } = await callById(arrivals, () =>
      gbisOk({ busArrivalList: [{ routeId: 200000001, routeName: "10", routeTypeCd: 13, predictTime1: 3 }] }),
    );
    expect(status).toBe(200);
    expect(body.arrivals).toMatchObject([{ routeId: "200000001", routeName: "10", predictMinutes: 3 }]);
  });

  it("노선 경로: GBIS 가 성공하면 200 과 좌표 목록", async () => {
    const { status, body } = await callById(path, () =>
      gbisOk({
        busRouteLineList: [
          { lineSeq: 2, x: 127.01, y: 37.27 },
          { lineSeq: 1, x: 127.0, y: 37.26 },
        ],
      }),
    );
    expect(status).toBe(200);
    expect(body.path).toEqual([
      { lat: 37.26, lng: 127.0 },
      { lat: 37.27, lng: 127.01 },
    ]);
  });
});
