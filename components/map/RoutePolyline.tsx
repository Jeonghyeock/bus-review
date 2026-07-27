"use client";

import { useEffect, useRef } from "react";

import { useRoutePath } from "@/lib/query/useRoutePath";

// 선택된 노선의 경로를 지도에 폴리라인으로 표시.
export default function RoutePolyline({ map, routeId }: { map: unknown; routeId: string }) {
  const lineRef = useRef<any>(null);
  const { data: path } = useRoutePath(routeId);

  useEffect(() => {
    if (!map || !window.naver?.maps || !path || path.length < 2) return;
    const { naver } = window;
    lineRef.current = new naver.maps.Polyline({
      map,
      path: path.map((p) => new naver.maps.LatLng(p.lat, p.lng)),
      strokeColor: "#2563eb",
      strokeWeight: 5,
      strokeOpacity: 0.75,
    });
    return () => {
      lineRef.current?.setMap(null);
      lineRef.current = null;
    };
  }, [map, path]);

  return null;
}
