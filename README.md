# 버스로그 — 경기 버스 리뷰

실시간 버스 도착·위치 정보를 **네이버지도 스타일 UI**로 보여주고, **노선·정류장에 리뷰**를 남길 수 있는 웹앱.

> 🔗 **데모: https://bus-review.vercel.app**

> ℹ️ **경기(수원 등) 지역은 GBIS 실시간 데이터로 동작합니다.** 서울은 TOPIS 인증키 문제로 아직 연결하지 않았고, 리뷰·즐겨찾기·인증은 Supabase로 라이브입니다.

> 2026년 10월의 개선 작업(PR #1~#11)은 Claude Code와 함께 했습니다.

## 주요 기능

- **주변 정류장** — 지도 영역 내 정류소를 중심부터 스트리밍으로 표시, 줌에 따라 **마커 클러스터링**
- **실시간 도착 정보**(30초 갱신) — 도착까지 분/남은 정거장, **혼잡도·저상버스·빈자리·다음 차량**까지
- **노선 실시간 추적** — 노선 선택 시 경로 폴리라인 + **실시간 버스 위치**(15초 갱신, 부드러운 이동 애니메이션) + 노선도 패널
- **리뷰** — 노선·정류장, 그리고 정류장에서 도착 버스를 펼치면 나오는 '이 노선 리뷰'(정류장×노선)에 별점 + 텍스트 (매직링크 로그인)
- **즐겨찾기** — 정류소·노선 저장, 목록에서 바로 이동
- **검색** — 정류장 자동완성
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
- **서울/경기 API 스키마가 달라** → `lib/bus/`에 provider 어댑터를 두고 **공통 타입으로 정규화**, 화면은 공통 타입만 다룸 (현재 구현은 경기 어댑터 하나. 서울은 `gyeonggi.ts`와 같은 함수들을 갖춘 어댑터를 추가하고, 도착·노선 조회는 지역에 따라 어댑터를 고르게, 주변 정류장·검색은 지역을 미리 알 수 없으니 두 지역을 함께 조회해 합치게 바꿀 예정)
- **GBIS 주변조회는 반경 ~500m 제약** → 보이는 지도 영역을 **500m 셀 격자로 나눠** 조회·병합하고, 셀 결과를 캐시(정류소는 불변)
- **넓은 영역도 빠르게 체감** → 셀을 **화면 중심에서 가까운 순으로** 조회하고, 서버가 **NDJSON 스트림**으로 완료되는 셀마다 흘려보내 **도착하는 대로 마커 표시** (한 번에 최대 24칸까지 조회 — 너무 넓게 축소하면 가장자리 정류장은 생략)
- **공공 API 호출 한도(429) 대응** → 셀 동시 요청을 6개로 제한 + backoff 재시도
- **실시간성** → 도착 30초 / 버스 위치 15초 폴링 + `requestAnimationFrame` 위치 보간으로 버스 마커를 부드럽게 이동
- **권한** → Supabase **RLS**로 리뷰·즐겨찾기를 본인만 쓰기/삭제, 프로필은 리뷰를 쓴 사람과 본인 것만 조회. 리뷰는 사람·대상마다 하나(다시 등록하면 그 리뷰를 고침)이고, 작성 시각은 서버가 정하며 본문 1000자·닉네임 30자 상한(0008). 프로필·리뷰 쓰기·`bus_targets` 정책, 닉네임 마이그레이션, 리뷰 상한(0008)은 `tests/rls.test.ts`가 마이그레이션 전체를 PGlite(WASM Postgres)에서 실행해 검증 (즐겨찾기 정책은 아직 테스트 없음)

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # 키 입력 (비워두면 BUS_USE_MOCK=true 로 목업 동작)
npm run dev                  # http://localhost:3000
```

Supabase 키를 넣어 리뷰·즐겨찾기까지 쓰려면, 그 프로젝트에 아래 [배포](#배포-vercel) 1단계의 마이그레이션을 먼저 실행합니다.

앱 실행·빌드와 테스트(`npm test`) 모두 Node 22.12 이상이 필요합니다(`@supabase/supabase-js` 2.110+는 Node 22, vitest 5는 22.12 이상 요구). main 푸시와 PR마다 GitHub Actions(`.github/workflows/ci.yml`)가 타입 검사·테스트·빌드를 돌립니다.

### 환경변수 (`.env.local`)

| 키 | 설명 |
|---|---|
| `NEXT_PUBLIC_NCP_KEY_ID` | 네이버 클라우드 플랫폼 Maps 키 (없으면 지도 자리에 안내 표시) |
| `NEXT_PUBLIC_SUPABASE_URL` / `_PUBLISHABLE_KEY` | Supabase 프로젝트 (구 프로젝트는 `_ANON_KEY`) |
| `GYEONGGI_BUS_API_KEY` | 공공데이터포털(data.go.kr) 경기버스(GBIS) Decoding 인증키 (서버 전용) |
| `BUS_USE_MOCK` | `false`가 아니면(값이 없어도) 실 API 없이 목업으로 동작, `false`면 실제 GBIS 데이터. 목업은 화면 확인용 예시라 서울 정류장도 섞여 있음 |

## 배포 (Vercel)

1. Supabase SQL Editor에서 `supabase/migrations/`의 파일을 **번호 순서대로 모두** 실행
   - 이미 일부를 적용한 DB라면 아직 적용하지 않은 번호부터 실행 (앞 번호를 다시 실행하면 "policy already exists" 오류로 멈춤)
   - 예: `0004`가 빠지면 도착 버스를 펼쳤을 때 나오는 '이 노선 리뷰'가 저장되지 않음
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
  bus/     types.ts, gyeonggi.ts(어댑터), index.ts(진입점·목업 전환), labels.ts, mock*.ts
  query/   TanStack Query 훅 (useStopsInView 스트리밍 등)
  supabase/ client.ts, server.ts, useUser.tsx(세션 Context)
store/     mapStore.ts        # Jotai
supabase/migrations/          # Postgres 스키마 + RLS
```

설계 배경은 [`DESIGN.md`](./DESIGN.md) 참고.
