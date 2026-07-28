"use client";

import { Bus } from "lucide-react";

import { CROWDED_COLOR, CROWDED_LABEL } from "@/lib/bus/labels";
import type { BusPosition } from "@/lib/bus/types";
import { useBusPositions } from "@/lib/query/useBusPositions";
import { useRouteStations } from "@/lib/query/useRouteStations";

// 노선의 전체 정류소를 순서대로 나열하고, 각 버스가 있는 정류소에 🚌 표시 (네이버지도 노선도)
export default function RouteStopList({ routeId }: { routeId: string }) {
  const { data: stations, isPending } = useRouteStations(routeId);
  const { data: buses } = useBusPositions(routeId);

  const busBySeq = new Map<number, BusPosition[]>();
  buses?.forEach((b) => {
    if (b.stationSeq == null) return;
    const arr = busBySeq.get(b.stationSeq) ?? [];
    arr.push(b);
    busBySeq.set(b.stationSeq, arr);
  });

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
          return (
            <li key={`${st.seq}-${st.id}`} className="flex items-stretch gap-2.5">
              <span className="relative flex w-3 shrink-0 justify-center">
                <span className="absolute inset-y-0 w-0.5 bg-gray-200" />
                <span className="relative z-10 mt-2 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-gray-300" />
              </span>
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1">
                <span className="truncate text-sm text-gray-700">{st.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {here.map((b) => (
                    <span
                      key={b.id}
                      title={`${b.plateNo ?? ""}${b.crowded ? ` · ${CROWDED_LABEL[b.crowded]}` : ""}`}
                      style={{ color: b.crowded ? CROWDED_COLOR[b.crowded] : "#2563eb" }}
                    >
                      <Bus size={16} />
                    </span>
                  ))}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
