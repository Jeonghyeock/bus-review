"use client";

import { useEffect, useRef } from "react";

// 지도에 현재 위치(파란 점) 표시
export default function MyLocationMarker({
  map,
  position,
}: {
  map: unknown;
  position: { lat: number; lng: number };
}) {
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !window.naver?.maps) return;
    const { naver } = window;
    const latlng = new naver.maps.LatLng(position.lat, position.lng);
    if (markerRef.current) {
      markerRef.current.setPosition(latlng);
    } else {
      markerRef.current = new naver.maps.Marker({
        position: latlng,
        map,
        zIndex: 1000,
        icon: {
          content:
            '<div style="width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.35),0 1px 4px rgba(0,0,0,.35)"></div>',
          anchor: new naver.maps.Point(8, 8),
        },
      });
    }
  }, [map, position]);

  useEffect(() => {
    return () => {
      markerRef.current?.setMap(null);
      markerRef.current = null;
    };
  }, []);

  return null;
}
