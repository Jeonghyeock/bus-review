"use client";

// 네이버지도 스타일 하단 시트
export default function BottomSheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 max-h-[58%] overflow-y-auto rounded-t-3xl bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
      <div className="sticky top-0 z-10 flex justify-center bg-white pb-1 pt-2.5">
        <div className="h-1.5 w-10 rounded-full bg-gray-200" />
      </div>
      <div className="px-5 pb-6">{children}</div>
    </div>
  );
}
