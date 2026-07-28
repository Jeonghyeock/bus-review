"use client";

import { useSetAtom } from "jotai";
import { useEffect, useRef } from "react";

import { CROWDED_COLOR, CROWDED_LABEL } from "@/lib/bus/labels";
import { useBusPositions } from "@/lib/query/useBusPositions";
import { selectedBusIdAtom } from "@/store/mapStore";

const DUR = 1400; // 보간 시간(ms)

type Entry = {
  marker: any;
  cur: { lat: number; lng: number };
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  start: number;
};

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
      if (existing) {
        existing.from = { ...existing.cur };
        existing.to = { lat: b.lat, lng: b.lng };
        existing.start = now;
      } else {
        const color = b.crowded ? CROWDED_COLOR[b.crowded] : "#2563eb";
        const tip =
          (b.plateNo ?? "") +
          (b.crowded ? ` · ${CROWDED_LABEL[b.crowded]}` : "") +
          (b.remainSeats != null ? ` · ${b.remainSeats}석` : "");
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(b.lat, b.lng),
          map,
          title: tip,
          icon: {
            content: `<div style="background:${color};border-radius:9999px;padding:1px 3px;font-size:15px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.35)">🚌</div>`,
            anchor: new naver.maps.Point(12, 12),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => setSelectedBusId(b.id));
        entries.current.set(b.id, {
          marker,
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
