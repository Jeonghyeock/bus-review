"use client";

import { useAtom, useSetAtom } from "jotai";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import BusMarkers from "@/components/map/BusMarkers";
import MyLocationButton from "@/components/map/MyLocationButton";
import MyLocationMarker from "@/components/map/MyLocationMarker";
import NaverMap from "@/components/map/NaverMap";
import RoutePolyline from "@/components/map/RoutePolyline";
import StopMarkers from "@/components/map/StopMarkers";
import RouteDetailPanel from "@/components/route/RouteDetailPanel";
import FavoritesList from "@/components/favorites/FavoritesList";
import SearchBar from "@/components/search/SearchBar";
import BottomSheet from "@/components/sheet/BottomSheet";
import RoutePanel from "@/components/sheet/RoutePanel";
import StopPanel from "@/components/sheet/StopPanel";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { Region, RouteStation, Stop } from "@/lib/bus/types";
import { type Bounds, useStopsInView } from "@/lib/query/useStopsInView";
import {
  mapCenterAtom,
  selectedBusIdAtom,
  selectedRouteAtom,
  selectedStopAtom,
} from "@/store/mapStore";

const MIN_ZOOM = 14;

export default function Home() {
  const [center] = useAtom(mapCenterAtom);
  const [selected, setSelected] = useAtom(selectedStopAtom);
  const [selectedRoute, setSelectedRoute] = useAtom(selectedRouteAtom);
  const [map, setMap] = useState<unknown>(null);
  const [zoom, setZoom] = useState(15);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [pendingCenter, setPendingCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const setSelectedBusId = useSetAtom(selectedBusIdAtom);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const appliedDeepLink = useRef(false);

  // 노선이 바뀌면 이전 버스 선택 해제
  useEffect(() => {
    setSelectedBusId(null);
  }, [selectedRoute, setSelectedBusId]);

  const canLoad = zoom >= MIN_ZOOM;
  const {
    data,
    pending: stopsPending,
    initialLoading,
    error: stopsError,
    retry: retryStops,
  } = useStopsInView(bounds, canLoad);
  const stops = canLoad ? data : [];
  // 처음 들어왔을 때만 로딩을 보여 준다. 지도를 옮길 때는 이전 정류소를 둔 채 바뀌므로 띄우지 않는다.
  // 지도가 준비된 뒤에만 띄운다 — 지도 SDK 로드에 실패하면 요청 자체가 없어 로딩이 끝나지 않기 때문이다.
  const showInitialLoading = canLoad && initialLoading && !!map;

  const handleIdle = (v: { lat: number; lng: number; zoom: number; bounds: Bounds }) => {
    setZoom(v.zoom);
    setBounds(v.bounds);
  };

  const moveTo = (lat: number, lng: number) => {
    if (map && window.naver?.maps) {
      (map as { panTo: (ll: unknown) => void }).panTo(new window.naver.maps.LatLng(lat, lng));
    } else {
      // 지도가 준비되기 전에 고른 위치(검색·즐겨찾기·현위치)는 버리지 않고 준비된 뒤에 이동한다
      setPendingCenter({ lat, lng });
    }
  };

  const handleSelectStop = useCallback(
    (stop: Stop) => {
      setSelectedRoute(null);
      setSelected(stop);
    },
    [setSelectedRoute, setSelected],
  );

  const handleSearchSelect = (stop: Stop) => {
    moveTo(stop.lat, stop.lng);
    handleSelectStop(stop);
  };

  // 노선도의 정류소 클릭 → 지도 이동
  const handleStationClick = (st: RouteStation) => moveTo(st.lat, st.lng);

  // 즐겨찾기 항목 선택
  const handleSelectFavorite = (f: {
    target_type: "route" | "stop";
    target_id: string;
    region: Region;
    name: string;
    lat: number | null;
    lng: number | null;
  }) => {
    if (f.target_type === "route") {
      setSelected(null);
      setSelectedRoute({ id: f.target_id, name: f.name, region: f.region });
    } else {
      setSelectedRoute(null);
      setSelected({
        id: f.target_id,
        name: f.name,
        region: f.region,
        lat: f.lat ?? 0,
        lng: f.lng ?? 0,
      });
      if (f.lat != null && f.lng != null) moveTo(f.lat, f.lng);
    }
  };

  // 딥링크: URL 파라미터로 들어온 정류소/노선 복원 (최초 1회)
  useEffect(() => {
    if (appliedDeepLink.current) return;
    appliedDeepLink.current = true;
    const p = new URLSearchParams(window.location.search);
    const region = (p.get("region") as Region) || "gyeonggi";
    if (p.get("route")) {
      setSelectedRoute({ id: p.get("route")!, name: p.get("rname") ?? p.get("route")!, region });
    } else if (p.get("stop")) {
      const slat = Number(p.get("slat"));
      const slng = Number(p.get("slng"));
      setSelected({ id: p.get("stop")!, name: p.get("sname") ?? "정류소", lat: slat, lng: slng, region });
      // 좌표 누락(0,0)이면 이동 생략 — 바다로 튀는 것 방지
      if (Number.isFinite(slat) && Number.isFinite(slng) && (slat !== 0 || slng !== 0)) {
        setPendingCenter({ lat: slat, lng: slng });
      }
    } else if (navigator.geolocation) {
      // 딥링크가 없으면 현재 위치로 (거부/실패 시 기본 수원역 유지)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setPendingCenter(c);
          setMyLocation(c);
        },
        () => {},
        { timeout: 5000 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 지도 준비되면 딥링크 좌표로 이동
  useEffect(() => {
    if (map && pendingCenter) {
      moveTo(pendingCenter.lat, pendingCenter.lng);
      setPendingCenter(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, pendingCenter]);

  // 선택 상태 → URL 반영 (공유 가능)
  useEffect(() => {
    const p = new URLSearchParams();
    if (selectedRoute) {
      p.set("route", selectedRoute.id);
      p.set("rname", selectedRoute.name);
      p.set("region", selectedRoute.region);
    } else if (selected) {
      p.set("stop", selected.id);
      p.set("sname", selected.name);
      p.set("slat", String(selected.lat));
      p.set("slng", String(selected.lng));
      p.set("region", selected.region);
    }
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [selected, selectedRoute]);

  // key: 다른 정류장·노선을 고르면 패널을 새로 만든다. 같은 인스턴스를 쓰면 쓰던 리뷰 초안·별점·오류 문구·펼친 노선이
  // 남아, 그 초안이 새로 고른 정류장의 리뷰로 등록된다.
  const content = selectedRoute ? (
    <RoutePanel
      key={selectedRoute.id}
      route={selectedRoute}
      onBack={() => setSelectedRoute(null)}
      showStops={!isDesktop}
      onSelectStation={handleStationClick}
    />
  ) : selected ? (
    <StopPanel key={selected.id} stop={selected} onBack={() => setSelected(null)} />
  ) : (
    <div>
      <FavoritesList onSelect={handleSelectFavorite} />
      <h2 className="text-lg font-bold text-gray-900">주변 정류장</h2>
      <p className="mt-0.5 text-xs text-gray-400">정류장을 선택하면 실시간 도착을 볼 수 있어요</p>
      {!canLoad ? (
        <p className="mt-3 rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
          지도를 확대하면 주변 정류소가 표시돼요
        </p>
      ) : (
        <ul className="mt-3 space-y-1">
          {stops?.map((s) => (
            <li key={s.id}>
              <button
                className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left hover:bg-gray-50"
                onClick={() => handleSelectStop(s)}
              >
                <span className="text-sm text-gray-800">{s.name}</span>
                {s.stationNo && <span className="text-xs text-gray-400">{s.stationNo}</span>}
              </button>
            </li>
          ))}
          {showInitialLoading && (
            <li className="flex items-center justify-center gap-2 rounded-xl bg-gray-50 py-6 text-sm text-gray-400">
              <LoaderCircle size={16} className="motion-safe:animate-spin" aria-hidden />
              주변 정류소를 불러오는 중…
            </li>
          )}
          {/* 요청이 끝난 뒤에만 결과 안내 — 진행 중에 '없어요'가 먼저 보이지 않게 한다 */}
          {!showInitialLoading && !stopsPending && stopsError && (
            <li className="flex items-center justify-center gap-2 rounded-xl bg-red-50 py-5 text-sm text-red-500">
              정류소를 불러오지 못했어요.
              <button className="font-medium underline underline-offset-2" onClick={retryStops}>
                다시 시도
              </button>
            </li>
          )}
          {!showInitialLoading && !stopsPending && !stopsError && stops?.length === 0 && (
            <li className="rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
              이 근처엔 정류소가 없어요. 지도를 옮겨보세요.
            </li>
          )}
        </ul>
      )}
    </div>
  );

  const searchEl = <SearchBar onSelect={handleSearchSelect} />;

  return (
    <main className="relative flex h-screen w-screen overflow-hidden">
      {/* 데스크톱: 왼쪽 사이드바가 실제 폭을 차지(flex) → 지도는 나머지 영역 */}
      {isDesktop && (
        <aside className="z-20 flex h-full w-[380px] shrink-0 flex-col gap-3 bg-white p-4 shadow-xl">
          {searchEl}
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        </aside>
      )}

      {/* 데스크톱: 노선 선택 시 사이드바 오른쪽에 노선도 패널 */}
      {isDesktop && selectedRoute && (
        <RouteDetailPanel
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
          onSelectStation={handleStationClick}
        />
      )}

      <div className="relative flex-1">
        <NaverMap center={center} onReady={setMap} onIdle={handleIdle} />
        {!!map && stops && (
          <StopMarkers
            map={map}
            stops={stops}
            zoom={zoom}
            onSelect={handleSelectStop}
            selectedStopId={selected?.id}
          />
        )}
        {!!map && selectedRoute && <RoutePolyline map={map} routeId={selectedRoute.id} />}
        {!!map && selectedRoute && <BusMarkers map={map} routeId={selectedRoute.id} />}
        {!!map && myLocation && <MyLocationMarker map={map} position={myLocation} />}
        {/* 스크린리더용 상태 알림 — 항상 두어야 내용이 바뀔 때 읽어 준다 */}
        <p role="status" className="sr-only">
          {showInitialLoading ? "주변 정류소를 불러오는 중" : ""}
        </p>
        {/* 모바일은 바텀시트가 접혀 있을 수 있어 지도 위에도 표시한다. 데스크톱은 사이드바 목록에 보인다. */}
        {showInitialLoading && !isDesktop && (
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[72px] z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-gray-600 shadow-md"
          >
            <LoaderCircle size={14} className="text-blue-600 motion-safe:animate-spin" />
            정류소 불러오는 중
          </div>
        )}
        <MyLocationButton
          onLocate={(lat, lng) => {
            moveTo(lat, lng);
            setMyLocation({ lat, lng });
          }}
        />

        {!isDesktop && (
          <>
            <div className="absolute left-1/2 top-3 z-20 w-[min(92%,440px)] -translate-x-1/2">
              {searchEl}
            </div>
            <BottomSheet>{content}</BottomSheet>
          </>
        )}
      </div>
    </main>
  );
}
