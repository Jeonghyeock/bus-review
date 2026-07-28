"use client";

import { useEffect, useState } from "react";

import type { Stop } from "@/lib/bus/types";

export type Bounds = { swLat: number; swLng: number; neLat: number; neLng: number };

// 지도 영역 내 정류소를 NDJSON 스트림으로 받아, 중심 셀부터 도착하는 대로 누적 표시.
export function useStopsInView(bounds: Bounds | null, enabled = true) {
  const [data, setData] = useState<Stop[]>([]);

  // 미세 이동 시 재조회를 줄이기 위해 소수 3자리로 반올림한 키
  const key =
    enabled && bounds
      ? [bounds.swLat, bounds.swLng, bounds.neLat, bounds.neLng].map((n) => n.toFixed(3)).join(",")
      : "";

  useEffect(() => {
    if (!enabled || !bounds) return;
    const ctrl = new AbortController();
    const acc = new Map<string, Stop>();
    let cancelled = false;

    (async () => {
      const b = bounds;
      const res = await fetch(
        `/api/stops/in-view?swLat=${b.swLat}&swLng=${b.swLng}&neLat=${b.neLat}&neLng=${b.neLng}`,
        { signal: ctrl.signal },
      );
      if (!res.ok || !res.body) throw new Error("정류장 조회 실패");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? ""; // 마지막 조각은 다음 청크와 이어붙임
        let changed = false;
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            (JSON.parse(line) as Stop[]).forEach((s) => acc.set(s.id, s));
            changed = true;
          } catch {
            /* 불완전 라인 무시 */
          }
        }
        if (changed && !cancelled) setData([...acc.values()]);
      }
      // 스트림 종료 시 최종 반영 (빈 영역이면 [] 로 이전 마커 정리)
      if (!cancelled) setData([...acc.values()]);
    })().catch((e) => {
      if ((e as Error).name !== "AbortError") console.error(e);
    });

    return () => {
      cancelled = true;
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { data };
}
