import { describe, expect, it } from "vitest";

import { mockArrivals } from "@/lib/bus/mock";

describe("mockArrivals", () => {
  it("정류장의 노선별 도착정보를 반환한다", () => {
    const arrivals = mockArrivals("s1");
    expect(arrivals.length).toBeGreaterThan(0);
    expect(arrivals[0]).toHaveProperty("predictMinutes");
    expect(arrivals[0]).toHaveProperty("routeName");
  });

  it("존재하지 않는 정류장은 빈 배열을 반환한다", () => {
    expect(mockArrivals("does-not-exist")).toEqual([]);
  });
});
