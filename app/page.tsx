"use client";

import { useAtom } from "jotai";
import { useState } from "react";

import BusMarkers from "@/components/map/BusMarkers";
import MyLocationButton from "@/components/map/MyLocationButton";
import NaverMap from "@/components/map/NaverMap";
import RoutePolyline from "@/components/map/RoutePolyline";
import StopMarkers from "@/components/map/StopMarkers";
import SearchBar from "@/components/search/SearchBar";
import BottomSheet from "@/components/sheet/BottomSheet";
import RoutePanel from "@/components/sheet/RoutePanel";
import StopPanel from "@/components/sheet/StopPanel";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { Stop } from "@/lib/bus/types";
import { useNearbyStops } from "@/lib/query/useNearbyStops";
import { mapCenterAtom, selectedRouteAtom, selectedStopAtom } from "@/store/mapStore";

const MIN_ZOOM = 14;

export default function Home() {
  const [center] = useAtom(mapCenterAtom);
  const [selected, setSelected] = useAtom(selectedStopAtom);
  const [selectedRoute, setSelectedRoute] = useAtom(selectedRouteAtom);
  const [map, setMap] = useState<unknown>(null);
  const [view, setView] = useState({ ...center, zoom: 15 });
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const canLoad = view.zoom >= MIN_ZOOM;
  const { data } = useNearbyStops(view.lat, view.lng, canLoad);
  const stops = canLoad ? data : [];

  const handleIdle = (v: { lat: number; lng: number; zoom: number }) => {
    const round = (n: number) => Math.round(n * 1e4) / 1e4;
    setView({ lat: round(v.lat), lng: round(v.lng), zoom: v.zoom });
  };

  const moveTo = (lat: number, lng: number) => {
    if (map && window.naver?.maps) {
      (map as { panTo: (ll: unknown) => void }).panTo(new window.naver.maps.LatLng(lat, lng));
    }
  };

  const handleSelectStop = (stop: Stop) => {
    setSelectedRoute(null);
    setSelected(stop);
  };

  const handleSearchSelect = (stop: Stop) => {
    moveTo(stop.lat, stop.lng);
    handleSelectStop(stop);
  };

  const content = selectedRoute ? (
    <RoutePanel route={selectedRoute} onBack={() => setSelectedRoute(null)} />
  ) : selected ? (
    <StopPanel stop={selected} onBack={() => setSelected(null)} />
  ) : (
    <div>
      <h2 className="text-lg font-bold text-gray-900">주변 정류장</h2>
      <p className="mt-0.5 text-xs text-gray-400">정류장을 선택하면 실시간 도착을 볼 수 있어요</p>
      {!canLoad ? (
        <p className="mt-3 rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
          지도를 확대하면 주변 정류소가 표시돼요
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {stops?.map((s) => (
            <li key={s.id}>
              <button
                className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-gray-50"
                onClick={() => handleSelectStop(s)}
              >
                <span className="text-sm text-gray-800">{s.name}</span>
                {s.stationNo && <span className="text-xs text-gray-400">{s.stationNo}</span>}
              </button>
            </li>
          ))}
          {stops?.length === 0 && (
            <li className="rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
              이 근처엔 정류소가 없어요. 지도를 옮겨보세요.
            </li>
          )}
        </ul>
      )}
    </div>
  );

  const searchEl = <SearchBar onSelect={handleSearchSelect} />;

  return (
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* 데스크톱: 왼쪽 사이드바가 실제 폭을 차지(flex) → 지도는 나머지 영역 */}
      {isDesktop && (
        <aside className="z-20 flex h-full w-[380px] shrink-0 flex-col gap-3 bg-white p-4 shadow-xl">
          {searchEl}
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        </aside>
      )}

      <div className="relative flex-1">
        <NaverMap center={center} onReady={setMap} onIdle={handleIdle} />
        {!!map && stops && <StopMarkers map={map} stops={stops} onSelect={handleSelectStop} />}
        {!!map && selectedRoute && <RoutePolyline map={map} routeId={selectedRoute.id} />}
        {!!map && selectedRoute && <BusMarkers map={map} routeId={selectedRoute.id} />}
        <MyLocationButton onLocate={moveTo} />

        {!isDesktop && (
          <>
            <div className="absolute left-1/2 top-3 z-20 w-[min(92%,440px)] -translate-x-1/2">
              {searchEl}
            </div>
            <BottomSheet>{content}</BottomSheet>
          </>
        )}
      </div>
    </main>
  );
}
