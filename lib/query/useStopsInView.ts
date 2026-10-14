"use client";

import { useCallback, useEffect, useState } from "react";

import type { Stop } from "@/lib/bus/types";

export type Bounds = { swLat: number; swLng: number; neLat: number; neLng: number };

// 서버가 스트림 끝에 붙이는 조회 요약(배열이 아닌 줄). 실패한 셀이 있을 때만 온다.
type StreamSummary = { failed: number; total: number };

// 지도 영역 내 정류소를 NDJSON 스트림으로 받아, 중심 셀부터 도착하는 대로 누적 표시.
// - pending: 지금 영역의 요청이 진행 중인지. '정류소 없음' 안내는 요청이 끝난 뒤에만 보여 주는 데 쓴다.
// - initialLoading: 첫 결과가 오기 전까지 true. 처음 들어왔을 때만 로딩을 보여 주는 데 쓴다.
//   이후 지도를 옮길 때는 이전 정류소를 둔 채 새 결과로 바꾸므로 로딩을 띄우지 않는다.
// - error: 가장 최근 요청이 실패했는지(요청 자체 실패, 또는 서버에서 모든 셀 조회가 실패). retry 로 다시 요청한다.
export function useStopsInView(bounds: Bounds | null, enabled = true) {
  const [data, setData] = useState<Stop[]>([]);
  const [pending, setPending] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // 미세 이동 시 재조회를 줄이기 위해 소수 3자리로 반올림한 키
  const key =
    enabled && bounds
      ? [bounds.swLat, bounds.swLng, bounds.neLat, bounds.neLng].map((n) => n.toFixed(3)).join(",")
      : "";

  useEffect(() => {
    if (!enabled || !bounds) {
      setPending(false);
      return;
    }
    const b = bounds;
    const ctrl = new AbortController();
    const acc = new Map<string, Stop>();
    let cancelled = false;
    setPending(true);
    setError(false);

    // 영역이 짧은 시간에 연달아 바뀌면(첫 화면 알림 직후 현재 위치로 이동 등) 마지막 영역만 요청한다.
    // 서버는 끊긴 요청의 남은 셀은 건너뛰지만 이미 시작한 셀은 끝까지 부르므로, 곧 버릴 요청은 아예 보내지 않는 편이 낫다.
    const timer = setTimeout(() => {
      load().catch((e) => {
        if (cancelled) return; // 다른 영역으로 바뀌어 취소된 요청
        console.error(e);
        setData([]); // 이전 영역 정류소를 지금 영역 결과처럼 남기지 않는다
        setError(true);
        setPending(false);
        setInitialLoading(false);
      });
    }, 150);

    async function load() {
      const res = await fetch(
        `/api/stops/in-view?swLat=${b.swLat}&swLng=${b.swLng}&neLat=${b.neLat}&neLng=${b.neLng}`,
        { signal: ctrl.signal },
      );
      if (!res.ok || !res.body) throw new Error("정류장 조회 실패");

      let summary: StreamSummary | null = null;
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
            const parsed: unknown = JSON.parse(line);
            if (Array.isArray(parsed)) {
              (parsed as Stop[]).forEach((s) => acc.set(s.id, s));
              changed = true;
            } else {
              summary = parsed as StreamSummary;
            }
          } catch {
            /* 불완전 라인 무시 */
          }
        }
        if (changed && !cancelled) {
          setData([...acc.values()]);
          setInitialLoading(false);
        }
      }
      if (cancelled) return;
      // 모든 셀 조회가 실패했으면 '정류소 없음'이 아니라 실패다. 일부만 실패하면 받은 만큼 보여 준다.
      const allFailed = summary !== null && summary.failed >= summary.total;
      // 스트림 종료 시 최종 반영 (빈 영역이면 [] 로 이전 마커 정리)
      setData(allFailed ? [] : [...acc.values()]);
      setError(allFailed);
      setPending(false);
      setInitialLoading(false);
    }

    return () => {
      cancelled = true;
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, attempt]);

  return { data, pending, initialLoading, error, retry };
}
