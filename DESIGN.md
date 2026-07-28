# 버스 리뷰 앱 — 설계 문서

> 서울·경기 버스의 **실시간 도착 정보를 네이버지도 스타일 UI로 보여주고**, **노선·정류장에 리뷰**를 달 수 있는 웹앱.
> (앱 이름 후보: 버스로그 / 버스타임 / 타볼까 — 정하면 교체)

이직용 포트폴리오. 증명 목표: **지도 SDK · 공공 API 실시간 데이터 · 풀스택 CRUD/인증 · 성능(클러스터링·캐싱) · 깔끔한 UX**.

> 📌 이 문서는 **초기 설계**다. 실제 구현·현재 구조/기능은 [`README.md`](./README.md)가 기준. (구현하며 달라진 부분: 서울 TOPIS 보류 → 경기 GBIS 라이브, 주변조회를 셀 격자 스트리밍으로, shadcn 미사용 등)

---

## 1. 기술 스택

| 영역 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | Next.js 15 (App Router) + TypeScript | Vercel 배포 |
| 지도 | **네이버 지도 (Naver Cloud Platform Maps JS SDK)** | ncpKeyId 필요, 무료 쿼터 |
| 서버 상태 | TanStack Query | 도착정보 폴링·캐싱 |
| 클라 UI 상태 | Jotai | 선택된 정류장/노선, 바텀시트 상태 |
| 백엔드(리뷰) | **Supabase** (Postgres + Auth + RLS) | 리뷰 CRUD·소셜 로그인 |
| 스타일 | Tailwind CSS v4 + lucide-react | 바텀시트·버튼 등 |
| 배포 | Vercel + Supabase Cloud | |

---

## 2. 데이터 소스 (공공 API)

버스 노선·정류장·**실시간 도착**은 우리 DB가 아니라 공공 API에서 가져온다. 리뷰만 우리 DB(Supabase)에 저장.

| 지역 | API | 제공 |
|---|---|---|
| 서울 | 서울 TOPIS / 공공데이터포털 — 정류소정보·노선정보·**버스도착정보** | 무료(키) |
| 경기 | GBIS(경기버스정보) / 공공데이터포털 — 정류소·노선·**도착정보** | 무료(키) |

> ⚠️ **중요 제약 2가지**
> 1. 공공 API는 **브라우저 CORS를 대부분 막는다** → 반드시 **Next.js 서버 라우트(Route Handler)를 경유**해서 호출. (API 키도 서버에 숨김)
> 2. 서울/경기 API는 **스키마가 다르다** → `lib/bus/` 에 **provider 어댑터**를 두고 **공통 타입으로 정규화**. (이게 코드 품질 어필 포인트)

---

## 3. 데이터 모델 (Supabase Postgres)

버스 노선/정류장 자체는 저장 안 함. **리뷰는 외부 API의 id를 target으로 참조.**

```sql
-- 사용자 프로필
profiles (
  id uuid PK references auth.users,
  nickname text,
  avatar_url text,
  created_at timestamptz default now()
)

-- 리뷰 (노선/정류장 공통)
reviews (
  id uuid PK default gen_random_uuid(),
  target_type text not null,          -- 'route' | 'stop'
  target_id text not null,            -- 외부 API의 노선ID / 정류장ID
  region text not null,               -- 'seoul' | 'gyeonggi'
  user_id uuid not null references profiles(id),
  rating int not null check (rating between 1 and 5),
  content text,
  tags text[] default '{}',           -- 예: '정시성','혼잡도','기사친절'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
create index on reviews (target_type, target_id);

-- 표시용 캐시(선택): 리뷰 목록에서 노선/정류장 이름을 API 재호출 없이 보여주기
bus_targets (
  target_type text, target_id text, region text,
  name text, meta jsonb,
  primary key (target_type, target_id)
)

-- 즐겨찾기 (구현됨 — 0003_favorites.sql)
favorites (user_id uuid, target_type text, target_id text, region text, name text, lat float8, lng float8,
           primary key(user_id,target_type,target_id))
```

**RLS(Row Level Security)** — 어필 포인트:
- `reviews` SELECT: 누구나
- `reviews` INSERT/UPDATE/DELETE: `auth.uid() = user_id` 인 본인만
- 평균 평점: `reviews`에서 집계(뷰 또는 쿼리 `avg(rating), count(*)`)

---

## 4. API 연동 계층 (Next.js Route Handlers)

클라이언트 → **우리 API 라우트** → 공공 API(정규화) / Supabase

```
GET /api/stops/in-view?swLat&swLng&neLat&neLng   지도 영역 정류소 (중심부터 NDJSON 스트리밍)
GET /api/stops/:id/arrivals                       정류장 실시간 도착 (30초 폴링)
GET /api/stops/search?q=                          정류장 검색
GET /api/routes/:id/stations                      노선 경유 정류소 (노선도)
GET /api/routes/:id/path                           노선 경로 폴리라인
GET /api/routes/:id/buses                          노선 실시간 버스 위치 (15초 폴링)
```

`lib/bus/` 구조 (어댑터 패턴):
```
lib/bus/
  types.ts        # 공통 타입: Stop, Arrival, BusPosition, RouteStation
  gyeonggi.ts     # 경기(GBIS) API → 공통 타입 (셀 격자·스트리밍·429 대응)
  index.ts        # region 보고 어댑터 선택 (streamStopsInBounds 등)
  labels.ts       # 혼잡도/노선유형 라벨·색상
  mock.ts / mockBuses.ts  # BUS_USE_MOCK 목업 데이터
```
> 서울 어댑터(`seoul.ts`)는 TOPIS 인증키 이슈로 보류 상태라 현재 코드에는 없다. 복구 시 같은 인터페이스로 추가하면 `index.ts` 디스패치만 늘리면 된다.

---

## 5. 화면 / UX (네이버지도 스타일)

- 전체화면 지도 배경
- **상단 검색바** — 정류장/노선 자동완성
- **바텀시트**(드래그, 스냅 3단계: 접힘/중간/펼침)
  - 기본: 주변 정류장 리스트
  - **정류장 선택**: 정류장명 → 실시간 도착(N분 후, 30초 폴링) → 경유 노선 목록 → **[정류장 리뷰] 탭**
  - **노선 선택**: 노선번호 → 경로(폴리라인) → **[노선 리뷰] 탭** → 리뷰 작성
- **리뷰**: 별점 + 텍스트 + 태그, 목록/평균 평점/정렬, 작성은 **로그인(Supabase 소셜) 필요**
- 마커: 상태/유형별 아이콘, **클러스터링**(정류장 많을 때 성능)

---

## 6. 폴더 구조

```
bus-review/
  app/
    layout.tsx
    page.tsx                         # 지도 메인 (사이드바/바텀시트 반응형)
    api/
      stops/in-view/route.ts         # 지도 영역 정류소 (스트리밍)
      stops/[id]/arrivals/route.ts
      stops/search/route.ts
      routes/[id]/{stations,path,buses}/route.ts
    auth/callback/route.ts           # Supabase 매직링크 콜백
  components/
    map/       NaverMap, StopMarkers, BusMarkers, RoutePolyline, MyLocation(Button|Marker)
    route/     RouteStopList, RouteDetailPanel
    sheet/     BottomSheet, StopPanel, RoutePanel
    review/    ReviewSection, RatingStars
    search/    SearchBar
    favorites/ FavoritesList
    common/    ShareButton, FavoriteButton
  lib/
    bus/      types.ts, gyeonggi.ts, index.ts, labels.ts, mock*.ts
    supabase/ client.ts (browser), server.ts (RSC/route), useUser.tsx (세션 Context)
    query/    queryKeys.ts, useStopsInView.ts, useArrivals.ts, useBusPositions.ts,
              useRoutePath.ts, useRouteStations.ts, useFavorites.ts
    hooks/    useMediaQuery.ts
  store/      mapStore.ts            # Jotai: selected stop/route/bus, center
  supabase/migrations/              # Postgres 스키마 + RLS
```

---

## 7. 마일스톤

| # | 목표 | 산출 |
|---|---|---|
| M0 | 세팅 | repo · Next.js · **네이버 지도 띄우기** · Supabase 연결 · env |
| M1 | 지도+정류장 | 주변 정류장 마커 + **클러스터링** + 클릭 시 바텀시트 |
| M2 | 실시간 도착 | 정류장 도착정보 API 어댑터 + **폴링/캐싱** |
| M3 | 노선 | 노선 상세 + 경로 폴리라인 |
| M4 | 리뷰 | 소셜 로그인 + **노선/정류장 리뷰 CRUD** + 평점 + RLS |
| M5 | 검색 | 정류장/노선 검색 자동완성 |
| M6 | 마무리 | 성능(클러스터·캐시) · 테스트 · **README(스크린샷/GIF)** · Vercel 배포 |

MVP = M0~M4. M5~M6은 완성도.

---

## 8. README 목차 (포트폴리오용 — 면접관이 보는 것)

1. 프로젝트 소개 + **데모 링크 & GIF**
2. 주요 기능 (지도·실시간 도착·리뷰·검색)
3. 기술 스택 + **아키텍처 다이어그램** (클라 → Next API 라우트 → 공공 API / Supabase)
4. 핵심 구현 포인트
   - 서울/경기 API 스키마 차이를 **어댑터 패턴으로 통합**
   - 공공 API 키를 **서버 라우트로 숨기고 정규화**(CORS·보안)
   - 정류장 **마커 클러스터링 + 도착정보 폴링 캐싱**(성능)
   - Supabase **RLS로 리뷰 권한 제어**(보안)
5. 트러블슈팅 / 성능 개선 (수치로)
6. 로컬 실행법 · 환경변수

---

## 9. 먼저 준비할 것 (계정·키)

- [ ] **네이버 클라우드 플랫폼** 가입 → Maps(Dynamic Map) 이용 신청 → `ncpKeyId`
- [ ] **공공데이터포털** 가입 → 서울/경기 버스 도착·노선·정류소 API 활용신청 → 서비스키
- [ ] **Supabase** 프로젝트 생성 → URL/anon key, 소셜 로그인(카카오/구글) 설정
- [ ] Vercel 연결

---

## 10. 리스크 / 주의

- 공공 API **CORS 차단** → 반드시 서버 경유 (설계에 반영됨)
- 네이버 지도 SDK는 **NCP(신규 ncpKeyId)** 기준으로 로드 (구 openapi 키와 다름)
- 도착정보 **호출량 제한**(일일 트래픽) → 폴링 주기 30초 + 서버 캐시로 절약
- 서울/경기 **정류장·노선 ID 체계가 달라** target_id에 region을 함께 저장
```
