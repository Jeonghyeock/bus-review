"use client";

import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { CROWDED_COLOR, CROWDED_LABEL } from "@/lib/bus/labels";
import type { BusPosition } from "@/lib/bus/types";
import { useBusPositions } from "@/lib/query/useBusPositions";
import { selectedBusIdAtom } from "@/store/mapStore";

const DUR = 1400; // 보간 시간(ms)

type Look = { title: string; icon: { content: string; anchor: unknown } };

type Entry = {
  marker: any;
  look: Look; // 마커에 지금 그려진 아이콘·툴팁 (폴링 때 달라진 것만 다시 그린다)
  cur: { lat: number; lng: number };
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  start: number;
};

// 혼잡도 색 아이콘과 툴팁(차량번호 · 혼잡도 · 빈자리). 마커를 만들 때와 폴링으로 혼잡도·빈자리가 바뀔 때 같이 쓴다.
function busLook(naver: any, b: BusPosition): Look {
  const color = b.crowded ? CROWDED_COLOR[b.crowded] : "#2563eb";
  return {
    title:
      (b.plateNo ?? "") +
      (b.crowded ? ` · ${CROWDED_LABEL[b.crowded]}` : "") +
      (b.remainSeats != null ? ` · ${b.remainSeats}석` : ""),
    icon: {
      content: `<div style="background:${color};border-radius:9999px;padding:1px 3px;font-size:15px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.35)">🚌</div>`,
      anchor: new naver.maps.Point(12, 12),
    },
  };
}

// 선택된 노선의 실시간 버스 위치 — 15초 폴링, 그 사이를 부드럽게 이동(보간).
export default function BusMarkers({ map, routeId }: { map: unknown; routeId: string }) {
  const entries = useRef<Map<string, Entry>>(new Map());
  const rafRef = useRef<number | null>(null);
  const { data: buses } = useBusPositions(routeId);
  const setSelectedBusId = useSetAtom(selectedBusIdAtom);

  useEffect(() => {
    if (!map || !window.naver?.maps || !buses) return;
    const { naver } = window;
    const now = performance.now();
    const seen = new Set<string>();

    buses.forEach((b) => {
      seen.add(b.id);
      const existing = entries.current.get(b.id);
      const look = busLook(naver, b);
      if (existing) {
        existing.from = { ...existing.cur };
        existing.to = { lat: b.lat, lng: b.lng };
        existing.start = now;
        // 위치뿐 아니라 혼잡도(색)·빈자리(툴팁)도 바뀔 수 있으므로, 달라졌으면 다시 그린다
        if (look.icon.content !== existing.look.icon.content) existing.marker.setIcon(look.icon);
        if (look.title !== existing.look.title) existing.marker.setTitle(look.title);
        existing.look = look;
      } else {
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(b.lat, b.lng),
          map,
          title: look.title,
          icon: look.icon,
        });
        naver.maps.Event.addListener(marker, "click", () => setSelectedBusId(b.id));
        entries.current.set(b.id, {
          marker,
          look,
          cur: { lat: b.lat, lng: b.lng },
          from: { lat: b.lat, lng: b.lng },
          to: { lat: b.lat, lng: b.lng },
          start: now,
        });
      }
    });

    // 사라진 버스 제거
    entries.current.forEach((e, id) => {
      if (!seen.has(id)) {
        e.marker.setMap(null);
        entries.current.delete(id);
      }
    });

    // 보간 루프
    if (rafRef.current == null) {
      const tick = () => {
        const t = performance.now();
        let active = false;
        entries.current.forEach((e) => {
          const k = Math.min(1, (t - e.start) / DUR);
          const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          const lat = e.from.lat + (e.to.lat - e.from.lat) * ease;
          const lng = e.from.lng + (e.to.lng - e.from.lng) * ease;
          e.cur = { lat, lng };
          e.marker.setPosition(new window.naver.maps.LatLng(lat, lng));
          if (k < 1) active = true;
        });
        rafRef.current = active ? requestAnimationFrame(tick) : null;
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [map, buses, setSelectedBusId]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      entries.current.forEach((e) => e.marker.setMap(null));
      entries.current.clear();
    };
  }, []);

  return null;
}
