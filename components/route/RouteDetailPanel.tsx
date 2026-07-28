"use client";

import { X } from "lucide-react";

import type { RouteStation } from "@/lib/bus/types";
import type { SelectedRoute } from "@/store/mapStore";

import RouteStopList from "./RouteStopList";

// 데스크톱: 사이드바 오른쪽에 뜨는 노선 상세(노선도) 패널
export default function RouteDetailPanel({
  route,
  onClose,
  onSelectStation,
}: {
  route: SelectedRoute;
  onClose: () => void;
  onSelectStation?: (station: RouteStation) => void;
}) {
  return (
    <div className="absolute bottom-4 left-[calc(380px+2rem)] top-4 z-10 flex w-[320px] flex-col rounded-2xl bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="font-bold text-gray-900">{route.name}</h3>
          <p className="text-xs text-gray-400">노선도 · 실시간 버스 위치</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="닫기">
          <X size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <RouteStopList routeId={route.id} onSelectStation={onSelectStation} />
      </div>
    </div>
  );
}
