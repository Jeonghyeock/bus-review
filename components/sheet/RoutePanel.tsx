"use client";

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
      <button onClick={onBack} className="mb-2 text-sm text-gray-500">
        ← 정류장으로
      </button>
      <h2 className="text-lg font-bold">{route.name}</h2>
      <p className="text-xs text-gray-500">{route.region === "seoul" ? "서울" : "경기"} · 노선</p>

      <ReviewSection targetType="route" targetId={route.id} region={route.region} />
    </div>
  );
}
