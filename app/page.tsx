"use client";

import { useAtom } from "jotai";
import { useState } from "react";

import BusMarkers from "@/components/map/BusMarkers";
import NaverMap from "@/components/map/NaverMap";
import StopMarkers from "@/components/map/StopMarkers";
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
  const { data: stops } = useNearbyStops(center.lat, center.lng);

  const handleSelectStop = (stop: Stop) => {
    setSelectedRoute(null);
    setSelected(stop);
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <NaverMap center={center} onReady={setMap} />
      {!!map && stops && <StopMarkers map={map} stops={stops} onSelect={handleSelectStop} />}
      {!!map && selectedRoute && <BusMarkers map={map} routeId={selectedRoute.id} />}

      <BottomSheet>
        {selectedRoute ? (
          <RoutePanel route={selectedRoute} onBack={() => setSelectedRoute(null)} />
        ) : selected ? (
          <StopPanel stop={selected} onBack={() => setSelected(null)} />
        ) : (
          <div>
            <h2 className="text-lg font-bold">주변 정류장</h2>
            <p className="text-xs text-gray-500">정류장을 선택하면 실시간 도착을 볼 수 있어요</p>
            <ul className="mt-3 divide-y">
              {stops?.map((s) => (
                <li key={s.id}>
                  <button
                    className="w-full py-2 text-left hover:text-blue-600"
                    onClick={() => handleSelectStop(s)}
                  >
                    {s.name}{" "}
                    <span className="text-xs text-gray-400">
                      ({s.region === "seoul" ? "서울" : "경기"})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </BottomSheet>
    </main>
  );
}
