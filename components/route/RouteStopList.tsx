"use client";

import { useAtomValue } from "jotai";
import { Bus } from "lucide-react";
import { useEffect, useRef } from "react";

import { CROWDED_COLOR, CROWDED_LABEL } from "@/lib/bus/labels";
import type { BusPosition, RouteStation } from "@/lib/bus/types";
import { useBusPositions } from "@/lib/query/useBusPositions";
import { useRouteStations } from "@/lib/query/useRouteStations";
import { selectedBusIdAtom } from "@/store/mapStore";

// 노선의 전체 정류소를 순서대로 나열하고, 각 버스가 있는 정류소에 🚌 표시 (네이버지도 노선도)
export default function RouteStopList({
  routeId,
  onSelectStation,
  highlightStopId,
}: {
  routeId: string;
  onSelectStation?: (station: RouteStation) => void;
  highlightStopId?: string;
}) {
  const { data: stations, isPending } = useRouteStations(routeId);
  const { data: buses } = useBusPositions(routeId);
  const selectedBusId = useAtomValue(selectedBusIdAtom);
  const rowRef = useRef<HTMLLIElement | null>(null);
  const originRef = useRef<HTMLLIElement | null>(null);

  const busBySeq = new Map<number, BusPosition[]>();
  buses?.forEach((b) => {
    if (b.stationSeq == null) return;
    const arr = busBySeq.get(b.stationSeq) ?? [];
    arr.push(b);
    busBySeq.set(b.stationSeq, arr);
  });

  const selectedSeq = buses?.find((b) => b.id === selectedBusId)?.stationSeq;

  // 버스 클릭 시 그 정류소로, 아니면 출발 정류장으로 스크롤
  useEffect(() => {
    if (selectedBusId) rowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    else if (highlightStopId)
      originRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedBusId, highlightStopId, stations]);

  if (isPending) return <p className="text-sm text-gray-400">노선 정보를 불러오는 중…</p>;
  if (!stations?.length) return <p className="text-sm text-gray-400">노선 정보가 없어요</p>;

  return (
    <div>
      <p className="mb-2 text-xs text-gray-400">
        정류소 {stations.length} · 운행 버스 {buses?.length ?? 0}
      </p>
      <ol>
        {stations.map((st) => {
          const here = busBySeq.get(st.seq) ?? [];
          const isSelected = selectedSeq != null && st.seq === selectedSeq;
          const isOrigin = highlightStopId != null && st.id === highlightStopId;
          return (
            <li
              key={`${st.seq}-${st.id}`}
              ref={isSelected ? rowRef : isOrigin ? originRef : undefined}
              className={`flex items-stretch gap-2.5 rounded-lg ${
                isSelected ? "bg-blue-50" : isOrigin ? "bg-amber-50" : ""
              }`}
            >
              <span className="relative flex w-3 shrink-0 justify-center">
                <span className="absolute inset-y-0 w-0.5 bg-gray-200" />
                <span
                  className={`relative z-10 mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white ${
                    isOrigin ? "bg-amber-500" : "bg-gray-300"
                  }`}
                />
              </span>
              <button
                onClick={() => onSelectStation?.(st)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`truncate text-sm hover:text-blue-600 ${isOrigin ? "font-semibold text-amber-700" : "text-gray-700"}`}
                  >
                    {st.name}
                  </span>
                  {isOrigin && (
                    <span className="shrink-0 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                      현재
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {here.map((b) => (
                    <span
                      key={b.id}
                      title={`${b.plateNo ?? ""}${b.crowded ? ` · ${CROWDED_LABEL[b.crowded]}` : ""}`}
                      className={b.id === selectedBusId ? "rounded-full bg-blue-100 p-0.5" : ""}
                      style={{ color: b.crowded ? CROWDED_COLOR[b.crowded] : "#2563eb" }}
                    >
                      <Bus size={16} />
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
