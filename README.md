# 버스로그 — 경기·서울 버스 리뷰

실시간 버스 도착·위치 정보를 **네이버지도 스타일 UI**로 보여주고, **노선·정류장에 리뷰**를 남길 수 있는 웹앱.

> 🔗 **데모: https://bus-review.vercel.app**

> ℹ️ **경기(수원 등) 지역은 GBIS 실시간 데이터로 동작합니다.** 서울은 TOPIS 인증키 동기화가 2025년 국가정보자원관리원(대전) 화재 여파로 지연 중이라, 어댑터 패턴(`lib/bus/`)으로 구조만 준비해 두고 복구 시 바로 연결됩니다. (리뷰·즐겨찾기·인증은 Supabase로 완전히 라이브)

## 주요 기능

- **주변 정류장** — 지도 영역 내 정류소를 중심부터 스트리밍으로 표시, 줌에 따라 **마커 클러스터링**
- **실시간 도착 정보**(30초 갱신) — 도착까지 분/남은 정거장, **혼잡도·저상버스·빈자리·다음 차량**까지
- **노선 실시간 추적** — 노선 선택 시 경로 폴리라인 + **실시간 버스 위치**(15초 갱신, 부드러운 이동 애니메이션) + 노선도 패널
- **리뷰** — 노선/정류장에 별점 + 텍스트 (매직링크 로그인)
- **즐겨찾기** — 정류소·노선 저장, 목록에서 바로 이동
- **검색** — 정류장/노선 자동완성
- **현위치** — 접속 시 동의받아 현재 위치로 이동 + 현위치 마커
- **딥링크·공유** — 선택 상태가 URL에 반영되어, 링크를 열면 그 화면이 복원
- **반응형** — 데스크톱은 좌측 사이드바, 모바일은 드래그 바텀시트

## 기술 스택

- **Next.js 15 (App Router)** · TypeScript · React 19
- **네이버 지도 (NCP Maps JS SDK)**
- **TanStack Query** (실시간 폴링·캐싱) · **Jotai** (지도 UI 상태)
- **Supabase** (Postgres · Auth · RLS) — 리뷰·즐겨찾기·인증
- Tailwind CSS v4 · lucide-react

## 아키텍처 포인트

- **공공 API의 CORS·키 노출 문제** → Next.js Route Handler(`app/api/*`)를 경유해 호출하고 API 키는 서버에만 보관
- **서울/경기 API 스키마가 달라** → `lib/bus/`에 provider 어댑터를 두고 **공통 타입으로 정규화**
- **GBIS 주변조회는 반경 ~500m 제약** → 보이는 지도 영역을 **500m 셀 격자로 나눠** 조회·병합하고, 셀 결과를 캐시(정류소는 불변)
- **넓은 영역도 빠르게 체감** → 셀을 **화면 중심에서 가까운 순으로** 조회하고, 서버가 **NDJSON 스트림**으로 완료되는 셀마다 흘려보내 **도착하는 대로 마커 표시**
- **공공 API 호출 한도(429) 대응** → 셀 동시 요청을 6개로 제한 + backoff 재시도
- **실시간성** → 도착 30초 / 버스 위치 15초 폴링 + `requestAnimationFrame` 위치 보간으로 버스 마커를 부드럽게 이동
- **권한** → Supabase **RLS**로 리뷰·즐겨찾기를 본인만 쓰기/삭제

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 키 입력 (비워두면 BUS_USE_MOCK=true 로 목업 동작)
npm run dev                  # http://localhost:3000
```

### 환경변수 (`.env.local`)

| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_NCP_KEY_ID` | 네이버 클라우드 플랫폼 Maps 키 (없으면 지도 자리에 안내 표시) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` | Supabase 프로젝트 (구 프로젝트는 `_ANON_KEY`) |
| `GYEONGGI_BUS_API_KEY` | 공공데이터포털(data.go.kr) 경기버스(GBIS) Decoding 인증키 (서버 전용) |
| `BUS_USE_MOCK` | `true`(기본)면 실 API 없이 목업으로 동작, `false`면 실제 GBIS 데이터 |

## 배포 (Vercel)

1. Supabase SQL Editor에서 `supabase/migrations/`의 `0001`·`0002`·`0003` 실행
2. Vercel에 위 환경변수 등록 (실데이터를 쓰려면 `BUS_USE_MOCK=false`)
3. 네이버 콘솔에 배포 도메인 등록, Supabase Auth의 Redirect URL에 배포 도메인 추가

## 구조

```
app/
  page.tsx                    # 지도 메인 (사이드바/바텀시트 반응형)
  api/                        # 공공 API 경유 라우트 (키 은닉·정규화·스트리밍)
  auth/callback/route.ts      # Supabase 매직링크 콜백
components/  map · route · sheet · review · search · favorites · common
lib/
  bus/     types.ts, gyeonggi.ts(어댑터), index.ts(region 디스패치), labels.ts, mock*.ts
  query/   TanStack Query 훅 (useStopsInView 스트리밍 등)
  supabase/ client.ts, server.ts, useUser.tsx(세션 Context)
store/     mapStore.ts        # Jotai
supabase/migrations/          # Postgres 스키마 + RLS
```

설계 배경은 [`DESIGN.md`](./DESIGN.md) 참고.
