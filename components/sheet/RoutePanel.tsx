"use client";

import { ArrowLeft, Bus } from "lucide-react";

import ReviewSection from "@/components/review/ReviewSection";
import type { SelectedRoute } from "@/store/mapStore";

export default function RoutePanel({
  route,
  onBack,
}: {
  route: SelectedRoute;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> 정류장으로
      </button>

      <div className="flex items-center gap-2.5">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-blue-50 text-blue-600">
          <Bus size={20} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{route.name}</h2>
          <p className="text-xs text-gray-400">{route.region === "seoul" ? "서울" : "경기"} · 노선</p>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-2 text-xs text-blue-600">
        🚌 지도에서 이 노선의 실시간 버스 위치를 볼 수 있어요 (15초 갱신)
      </p>

      <ReviewSection targetType="route" targetId={route.id} region={route.region} />
    </div>
  );
}
