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
import type { Stop } from "@/lib/bus/types";
import { useNearbyStops } from "@/lib/query/useNearbyStops";
import { mapCenterAtom, selectedRouteAtom, selectedStopAtom } from "@/store/mapStore";

export default function Home() {
  const [center] = useAtom(mapCenterAtom);
  const [selected, setSelected] = useAtom(selectedStopAtom);
  const [selectedRoute, setSelectedRoute] = useAtom(selectedRouteAtom);
  const [map, setMap] = useState<unknown>(null);
  const [view, setView] = useState({ ...center, zoom: 15 });

  // 너무 축소된 상태(넓은 범위)에선 조회하지 않음 — GBIS 반경 500m 특성상 의미 없음
  const MIN_ZOOM = 14;
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

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <NaverMap center={center} onReady={setMap} onIdle={handleIdle} />
      {!!map && stops && <StopMarkers map={map} stops={stops} onSelect={handleSelectStop} />}
      {!!map && selectedRoute && <RoutePolyline map={map} routeId={selectedRoute.id} />}
      {!!map && selectedRoute && <BusMarkers map={map} routeId={selectedRoute.id} />}

      <SearchBar onSelect={handleSearchSelect} />
      <MyLocationButton onLocate={moveTo} />

      <BottomSheet>
        {selectedRoute ? (
          <RoutePanel route={selectedRoute} onBack={() => setSelectedRoute(null)} />
        ) : selected ? (
          <StopPanel stop={selected} onBack={() => setSelected(null)} />
        ) : (
          <div>
            <h2 className="text-lg font-bold text-gray-900">주변 정류장</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              정류장을 선택하면 실시간 도착을 볼 수 있어요
            </p>
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
        )}
      </BottomSheet>
    </main>
  );
}
