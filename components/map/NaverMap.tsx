"use client";

import { useEffect, useRef, useState } from "react";

const NCP_KEY = process.env.NEXT_PUBLIC_NCP_KEY_ID;

function loadNaverScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.naver?.maps) return resolve();

    const id = "naver-maps-sdk";
    if (document.getElementById(id)) {
      // 이미 로딩 중이면 준비될 때까지 폴링
      const timer = setInterval(() => {
        if (window.naver?.maps) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${NCP_KEY}`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("네이버 지도 SDK 로드 실패 (키/도메인 확인)"));
    document.head.appendChild(script);
  });
}

type LatLng = { lat: number; lng: number };

export default function NaverMap({
  center,
  onReady,
}: {
  center: LatLng;
  onReady?: (map: unknown) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!NCP_KEY) {
      setError("NEXT_PUBLIC_NCP_KEY_ID 미설정 — .env.local 에 네이버 지도 키를 넣어주세요");
      return;
    }
    let cancelled = false;
    loadNaverScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        const map = new window.naver.maps.Map(ref.current, {
          center: new window.naver.maps.LatLng(center.lat, center.lng),
          zoom: 15,
        });
        onReady?.(map);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // 지도는 최초 1회만 생성 (center 변경은 별도 로직으로 panTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 p-6 text-center text-sm text-gray-600">
          {error}
        </div>
      )}
    </div>
  );
}
