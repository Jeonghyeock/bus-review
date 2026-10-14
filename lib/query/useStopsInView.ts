"use client";

import { useEffect, useState } from "react";

import type { Stop } from "@/lib/bus/types";

export type Bounds = { swLat: number; swLng: number; neLat: number; neLng: number };

// 지도 영역 내 정류소를 NDJSON 스트림으로 받아, 중심 셀부터 도착하는 대로 누적 표시.
// initialLoading: 첫 결과(첫 조각 또는 빈 응답)가 오기 전까지 true — 처음 들어왔을 때만 로딩을 보여 주는 데 쓴다.
//                 이후 지도를 옮길 때는 이전 정류소를 그대로 둔 채 새 결과로 바꾸므로 로딩 상태가 없다.
// error: 가장 최근 요청이 실패했는지
export function useStopsInView(bounds: Bounds | null, enabled = true) {
  const [data, setData] = useState<Stop[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);

  // 미세 이동 시 재조회를 줄이기 위해 소수 3자리로 반올림한 키
  const key =
    enabled && bounds
      ? [bounds.swLat, bounds.swLng, bounds.neLat, bounds.neLng].map((n) => n.toFixed(3)).join(",")
      : "";

  useEffect(() => {
    if (!enabled || !bounds) return;
    const b = bounds;
    const ctrl = new AbortController();
    const acc = new Map<string, Stop>();
    let cancelled = false;

    // 영역이 짧은 시간에 연달아 바뀌면(첫 화면 알림 직후 현재 위치로 이동 등) 마지막 영역만 요청한다.
    // 서버는 요청이 취소돼도 공공 API 조회를 끝까지 돌리므로, 곧 버릴 요청은 아예 보내지 않는다.
    const timer = setTimeout(() => {
      load().catch((e) => {
        if ((e as Error).name === "AbortError" || cancelled) return;
        console.error(e);
        setError(true);
        setInitialLoading(false);
      });
    }, 150);

    async function load() {
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
        if (changed && !cancelled) {
          setData([...acc.values()]);
          setInitialLoading(false);
        }
      }
      // 스트림 종료 시 최종 반영 (빈 영역이면 [] 로 이전 마커 정리)
      if (!cancelled) {
        setData([...acc.values()]);
        setInitialLoading(false);
        setError(false);
      }
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return { data, initialLoading, error };
}
