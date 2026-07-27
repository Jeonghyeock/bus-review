"use client";

import { useEffect, useRef } from "react";

import type { Stop } from "@/lib/bus/types";

// 지도 위 정류장 마커. stops 가 바뀌면 마커를 재생성한다.
// (확장: 정류장 수천 개일 때 MarkerClustering 도입 → 성능 어필 포인트)
export default function StopMarkers({
  map,
  stops,
  onSelect,
}: {
  map: unknown;
  stops: Stop[];
  onSelect: (stop: Stop) => void;
}) {
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!map || !window.naver?.maps) return;
    const { naver } = window;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = stops.map((stop) => {
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(stop.lat, stop.lng),
        map,
        title: stop.name,
      });
      naver.maps.Event.addListener(marker, "click", () => onSelect(stop));
      return marker;
    });

    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, [map, stops, onSelect]);

  return null;
}
