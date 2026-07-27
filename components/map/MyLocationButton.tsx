"use client";

import { LocateFixed } from "lucide-react";

export default function MyLocationButton({
  onLocate,
}: {
  onLocate: (lat: number, lng: number) => void;
}) {
  const handle = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저는 위치 조회를 지원하지 않아요.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocate(pos.coords.latitude, pos.coords.longitude),
      () => alert("위치 권한을 허용해 주세요."),
    );
  };

  return (
    <button
      onClick={handle}
      aria-label="현재 위치"
      className="absolute right-4 top-[4.5rem] z-20 grid h-11 w-11 place-items-center rounded-full border border-gray-100 bg-white text-gray-600 shadow-lg transition hover:text-blue-600"
    >
      <LocateFixed size={20} />
    </button>
  );
}
