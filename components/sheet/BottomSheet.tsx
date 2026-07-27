"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

// 네이버지도 스타일 하단 시트 — 핸들 탭으로 접기/펼치기
export default function BottomSheet({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-[max-height] duration-300 ${
        expanded ? "max-h-[62%]" : "max-h-[3.5rem]"
      }`}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex shrink-0 flex-col items-center gap-0.5 pb-1 pt-2.5"
        aria-label={expanded ? "접기" : "펼치기"}
      >
        <span className="h-1.5 w-10 rounded-full bg-gray-200" />
        {expanded ? (
          <ChevronDown size={15} className="text-gray-300" />
        ) : (
          <ChevronUp size={15} className="text-gray-300" />
        )}
      </button>
      <div className="overflow-y-auto px-5 pb-6">{children}</div>
    </div>
  );
}
