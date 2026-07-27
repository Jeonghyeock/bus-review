"use client";

// 네이버지도 스타일 하단 시트 (확장: 드래그 스냅 3단계)
export default function BottomSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 max-h-[55%] overflow-y-auto rounded-t-2xl bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.12)]">
      <div className="mx-auto my-2 h-1.5 w-10 rounded-full bg-gray-300" />
      <div className="p-4">{children}</div>
    </div>
  );
}
