"use client";

import { useSetAtom } from "jotai";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import FavoriteButton from "@/components/common/FavoriteButton";
import ShareButton from "@/components/common/ShareButton";
import ReviewSection from "@/components/review/ReviewSection";
import { CROWDED_COLOR, CROWDED_LABEL } from "@/lib/bus/labels";
import type { Stop } from "@/lib/bus/types";
import { useArrivals } from "@/lib/query/useArrivals";
import { selectedRouteAtom, sheetExpandSignalAtom } from "@/store/mapStore";

export default function StopPanel({ stop, onBack }: { stop: Stop; onBack: () => void }) {
  const { data: arrivals, isPending, isError } = useArrivals(stop.id);
  const setRoute = useSetAtom(selectedRouteAtom);
  const bumpSheet = useSetAtom(sheetExpandSignalAtom);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 지도에서 이 노선 전체 보기 — 출발 정류장 컨텍스트를 함께 넘겨 노선도에서 하이라이트
  const openRoute = (routeId: string, routeName: string) =>
    setRoute({
      id: routeId,
      name: routeName,
      region: stop.region,
      fromStopId: stop.id,
      fromStopName: stop.name,
    });

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft size={16} /> 주변 정류장
      </button>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="truncate text-xl font-bold text-gray-900">{stop.name}</h2>
          {stop.stationNo && (
            <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
              {stop.stationNo}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <FavoriteButton
            item={{
              target_type: "stop",
              target_id: stop.id,
              region: stop.region,
              name: stop.name,
              lat: stop.lat,
              lng: stop.lng,
            }}
          />
          <ShareButton />
        </div>
      </div>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-400">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
        실시간 도착 · 30초 갱신
      </p>

      <ul className="mt-3 space-y-1.5">
        {isPending && (
          <li className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
            불러오는 중…
          </li>
        )}
        {isError && (
          <li className="rounded-xl bg-red-50 px-3 py-4 text-center text-sm text-red-500">
            도착정보를 불러오지 못했어요
          </li>
        )}
        {arrivals?.length === 0 && !isPending && (
          <li className="rounded-xl bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">
            도착 예정 버스가 없어요
          </li>
        )}
        {arrivals?.map((a) => {
          const isOpen = expandedId === a.routeId;
          return (
            <li
              key={a.routeId}
              className={`overflow-hidden rounded-xl border transition ${isOpen ? "border-blue-200" : "border-gray-100"}`}
            >
              <button
                onClick={() => {
                  const next = isOpen ? null : a.routeId;
                  setExpandedId(next);
                  if (next) bumpSheet((n) => n + 1); // 모바일 바텀시트 자동 펼침
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-blue-50/40"
                title="도착 상세 · 이 정류장의 이 노선 리뷰"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-gray-900">{a.routeName}</span>
                    {a.routeType && <span className="text-[10px] text-gray-400">{a.routeType}</span>}
                    {a.lowPlate && (
                      <span className="rounded bg-emerald-50 px-1 text-[10px] text-emerald-600">
                        저상
                      </span>
                    )}
                  </div>
                  {a.destName && <div className="truncate text-xs text-gray-400">→ {a.destName}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">
                      {a.message ?? `${a.predictMinutes}분`}
                    </div>
                    <div className="flex items-center justify-end gap-1.5 text-[10px]">
                      {a.remainStops != null && (
                        <span className="text-gray-400">{a.remainStops}정거장</span>
                      )}
                      {a.crowded && (
                        <span style={{ color: CROWDED_COLOR[a.crowded] }}>
                          {CROWDED_LABEL[a.crowded]}
                        </span>
                      )}
                      {a.remainSeats != null && (
                        <span className="text-gray-400">{a.remainSeats}석</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`shrink-0 text-gray-300 transition-transform ${isOpen ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-3 py-3">
                  {/* 도착 상세 */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">
                      {a.message ?? `${a.predictMinutes}분 후 도착`}
                    </span>
                    {a.next && (
                      <span>
                        다음 차 {a.next.predictMinutes}분
                        {a.next.remainStops != null ? ` · ${a.next.remainStops}정거장` : ""}
                      </span>
                    )}
                    {a.plateNo && <span>차량 {a.plateNo}</span>}
                  </div>

                  <button
                    onClick={() => openRoute(a.routeId, a.routeName)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    지도에서 이 노선 전체 보기 <ChevronRight size={13} />
                  </button>

                  {/* 이 정류장 × 이 노선 리뷰 */}
                  <ReviewSection
                    targetType="stop_route"
                    targetId={`${stop.id}:${a.routeId}`}
                    region={stop.region}
                    title="이 노선 리뷰"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <ReviewSection
        targetType="stop"
        targetId={stop.id}
        region={stop.region}
        title="정류장 리뷰"
      />
    </div>
  );
}
