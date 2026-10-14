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
  onIdle,
}: {
  center: LatLng;
  onReady?: (map: unknown) => void;
  onIdle?: (view: {
    lat: number;
    lng: number;
    zoom: number;
    bounds: { swLat: number; swLng: number; neLat: number; neLng: number };
  }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const roRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!NCP_KEY) {
      setError("NEXT_PUBLIC_NCP_KEY_ID 미설정 — .env.local 에 네이버 지도 키를 넣어주세요");
      return;
    }
    let cancelled = false;
    let disposeMap: (() => void) | null = null;
    loadNaverScript()
      .then(() => {
        if (cancelled || !ref.current) return;
        const { maps } = window.naver;
        const map = new maps.Map(ref.current, {
          center: new maps.LatLng(center.lat, center.lng),
          zoom: 15,
        });
        let ready = false;
        // 지금 보이는 영역을 알린다 (그 지역 정류소 조회용)
        const emitView = () => {
          const c = map.getCenter();
          const b = map.getBounds();
          const sw = b.getSW();
          const ne = b.getNE();
          onIdleRef.current?.({
            lat: c.lat(),
            lng: c.lng(),
            zoom: map.getZoom(),
            bounds: { swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng() },
          });
        };
        // 첫 화면에서는 idle 이 오지 않는다(init·tilesloaded 만 온다). 준비가 끝나면 한 번 알리고,
        // 지도도 그때 넘겨서 준비 전에 panTo 가 불리지 않게 한다 — 준비 전에 이동하면 idle 없이 위치만 바뀐다.
        const markReady = () => {
          if (ready || cancelled) return;
          ready = true;
          onReadyRef.current?.(map);
          emitView();
        };
        maps.Event.once(map, "init", markReady);
        // init 이 끝내 오지 않더라도(SDK 동작이 바뀌는 등) 지도를 못 쓰는 상태로 남지 않게 늦게라도 준비 처리
        const readyFallback = setTimeout(markReady, 5000);
        // 이동/줌이 끝날 때마다 알림
        const idleListener = maps.Event.addListener(map, "idle", () => {
          if (ready) emitView();
        });
        // 컨테이너 크기 변화(반응형 레이아웃/창 리사이즈) 시 지도를 재정렬하고, 넓어진 영역도 알림
        roRef.current = new ResizeObserver(() => {
          maps.Event.trigger(map, "resize");
          if (ready) emitView();
        });
        roRef.current.observe(ref.current);
        // 언마운트 뒤에 남은 지도가 부모 콜백을 부르지 않게 리스너만 뗀다.
        // map.destroy() 는 마커·경로선 컴포넌트가 아직 지도를 붙잡고 정리하는 중일 수 있어 부르지 않는다.
        disposeMap = () => {
          clearTimeout(readyFallback);
          maps.Event.removeListener(idleListener);
        };
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      cancelled = true;
      roRef.current?.disconnect();
      disposeMap?.();
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
