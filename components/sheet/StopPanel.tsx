"use client";

import { useSetAtom } from "jotai";

import ReviewSection from "@/components/review/ReviewSection";
import { useArrivals } from "@/lib/query/useArrivals";
import type { Stop } from "@/lib/bus/types";
import { selectedRouteAtom } from "@/store/mapStore";

export default function StopPanel({ stop, onBack }: { stop: Stop; onBack: () => void }) {
  const { data: arrivals, isPending, isError } = useArrivals(stop.id);
  const setRoute = useSetAtom(selectedRouteAtom);

  return (
    <div>
      <button onClick={onBack} className="mb-2 text-sm text-gray-500">
        ← 주변 정류장
      </button>
      <h2 className="text-lg font-bold">{stop.name}</h2>
      <p className="text-xs text-gray-500">
        {stop.region === "seoul" ? "서울" : "경기"} · 실시간 도착 (30초 갱신)
      </p>

      <ul className="mt-3 divide-y">
        {isPending && <li className="py-2 text-sm text-gray-400">불러오는 중…</li>}
        {isError && <li className="py-2 text-sm text-red-500">도착정보를 불러오지 못했습니다</li>}
        {arrivals?.map((a) => (
          <li key={a.routeId} className="flex items-center justify-between py-2">
            <button
              className="text-left font-medium hover:text-blue-600"
              onClick={() => setRoute({ id: a.routeId, name: a.routeName, region: stop.region })}
              title="노선 리뷰 보기"
            >
              {a.routeName}
            </button>
            <span className="text-sm text-blue-600">
              {a.message
                ? a.message
                : `${a.predictMinutes}분 후${a.remainStops != null ? ` · ${a.remainStops}정거장` : ""}`}
            </span>
          </li>
        ))}
      </ul>

      <ReviewSection targetType="stop" targetId={stop.id} region={stop.region} />
    </div>
  );
}
