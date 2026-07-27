"use client";

import { useEffect, useRef, useState } from "react";

const COLLAPSED = 56; // 접힌 높이(px) — 핸들만 보임

// 드래그로 크기 조절되는 하단 시트 (접힘 ↔ 펼침 스냅, 짧은 탭은 토글)
export default function BottomSheet({ children }: { children: React.ReactNode }) {
  const [maxH, setMaxH] = useState(600); // 펼친 높이
  const [height, setHeight] = useState(600);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(null);

  useEffect(() => {
    const calc = () => {
      const exp = Math.round(window.innerHeight * 0.62);
      setMaxH(exp);
      setHeight((h) => (h > COLLAPSED + 20 ? exp : COLLAPSED));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startH: height, moved: false };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dy = drag.current.startY - e.clientY; // 위로 끌면 +
    if (Math.abs(dy) > 4) drag.current.moved = true;
    setHeight(Math.min(maxH, Math.max(COLLAPSED, drag.current.startH + dy)));
  };

  const onPointerUp = () => {
    if (!drag.current) return;
    const { moved, startH } = drag.current;
    setHeight((h) =>
      !moved
        ? startH > COLLAPSED + 20
          ? COLLAPSED // 탭 → 토글
          : maxH
        : h > (COLLAPSED + maxH) / 2 // 드래그 → 가까운 쪽으로 스냅
          ? maxH
          : COLLAPSED,
    );
    drag.current = null;
    setDragging(false);
  };

  return (
    <div
      className="absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
      style={{ height, transition: dragging ? "none" : "height 0.25s ease" }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="flex shrink-0 touch-none justify-center py-3.5"
      >
        <span className="h-1.5 w-10 rounded-full bg-gray-300" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
    </div>
  );
}
