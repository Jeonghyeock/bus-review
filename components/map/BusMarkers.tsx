"use client";

import { useEffect, useRef, useState } from "react";

import { mockBusPositions } from "@/lib/bus/mockBuses";

// 선택된 노선의 버스들을 지도 위에 실시간으로 움직이는 마커로 표시.
// 1초마다 위치를 갱신하고, 마커는 재생성 대신 setPosition 으로 이동시킨다.
export default function BusMarkers({ map, routeId }: { map: unknown; routeId: string }) {
  const markersRef = useRef<any[]>([]);
  const [tick, setTick] = useState(0);

  // 1초 틱
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [routeId]);

  // 위치 갱신
  useEffect(() => {
    if (!map || !window.naver?.maps) return;
    const { naver } = window;
    const positions = mockBusPositions(routeId, tick);

    if (markersRef.current.length !== positions.length) {
      // 개수 변화 시 재생성
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = positions.map(
        (p) =>
          new naver.maps.Marker({
            position: new naver.maps.LatLng(p.lat, p.lng),
            map,
            icon: {
              content: '<div style="font-size:22px;line-height:1">🚌</div>',
              anchor: new naver.maps.Point(11, 11),
            },
          }),
      );
    } else {
      // 위치만 이동 (부드러운 움직임)
      positions.forEach((p, i) =>
        markersRef.current[i].setPosition(new naver.maps.LatLng(p.lat, p.lng)),
      );
    }
  }, [map, routeId, tick]);

  // 언마운트 시 마커 정리
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, []);

  return null;
}
