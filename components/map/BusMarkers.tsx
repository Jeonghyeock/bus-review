"use client";

import { useEffect, useRef } from "react";

import { CROWDED_COLOR, CROWDED_LABEL } from "@/lib/bus/labels";
import { useBusPositions } from "@/lib/query/useBusPositions";

// 선택된 노선의 실시간 버스 위치를 지도에 표시 (15초 폴링).
export default function BusMarkers({ map, routeId }: { map: unknown; routeId: string }) {
  const markersRef = useRef<any[]>([]);
  const { data: buses } = useBusPositions(routeId);

  useEffect(() => {
    if (!map || !window.naver?.maps || !buses) return;
    const { naver } = window;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = buses.map((b) => {
      const color = b.crowded ? CROWDED_COLOR[b.crowded] : "#2563eb";
      const tip =
        (b.plateNo ?? "") +
        (b.crowded ? ` · ${CROWDED_LABEL[b.crowded]}` : "") +
        (b.remainSeats != null ? ` · ${b.remainSeats}석` : "");
      return new naver.maps.Marker({
        position: new naver.maps.LatLng(b.lat, b.lng),
        map,
        title: tip,
        icon: {
          content: `<div style="background:${color};border-radius:9999px;padding:1px 3px;font-size:15px;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,.35)">🚌</div>`,
          anchor: new naver.maps.Point(12, 12),
        },
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, buses]);

  return null;
}
