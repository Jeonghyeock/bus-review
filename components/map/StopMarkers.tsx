"use client";

import { useEffect, useRef } from "react";

import type { Stop } from "@/lib/bus/types";

// 정류소 마커 — 줌에 따라 가까운 것들을 격자로 묶어(클러스터) 표시.
export default function StopMarkers({
  map,
  stops,
  zoom,
  onSelect,
}: {
  map: unknown;
  stops: Stop[];
  zoom: number;
  onSelect: (stop: Stop) => void;
}) {
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || !window.naver?.maps) return;
    const { naver } = window;
    const m = map as any;

    markersRef.current.forEach((mk) => mk.setMap(null));
    markersRef.current = [];

    // 화면 ~60px 정도의 격자 셀(도 단위)
    const cell = 90 / Math.pow(2, zoom);
    const cells = new Map<string, Stop[]>();
    stops.forEach((s) => {
      const key = `${Math.floor(s.lat / cell)},${Math.floor(s.lng / cell)}`;
      const arr = cells.get(key) ?? [];
      arr.push(s);
      cells.set(key, arr);
    });

    cells.forEach((group) => {
      if (group.length === 1) {
        const s = group[0];
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(s.lat, s.lng),
          map,
          title: s.name,
        });
        naver.maps.Event.addListener(marker, "click", () => onSelect(s));
        markersRef.current.push(marker);
      } else {
        const lat = group.reduce((a, s) => a + s.lat, 0) / group.length;
        const lng = group.reduce((a, s) => a + s.lng, 0) / group.length;
        const size = group.length >= 20 ? 46 : group.length >= 10 ? 40 : 34;
        const marker = new naver.maps.Marker({
          position: new naver.maps.LatLng(lat, lng),
          map,
          icon: {
            content: `<div style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:rgba(37,99,235,.9);color:#fff;font-size:12px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.3)">${group.length}</div>`,
            anchor: new naver.maps.Point(size / 2, size / 2),
          },
        });
        naver.maps.Event.addListener(marker, "click", () => {
          const target = new naver.maps.LatLng(lat, lng);
          const nextZoom = Math.min(zoom + 2, 19);
          if (m.morph) m.morph(target, nextZoom);
          else {
            m.setZoom(nextZoom);
            m.panTo(target);
          }
        });
        markersRef.current.push(marker);
      }
    });

    return () => {
      markersRef.current.forEach((mk) => mk.setMap(null));
      markersRef.current = [];
    };
  }, [map, stops, zoom, onSelect]);

  return null;
}
