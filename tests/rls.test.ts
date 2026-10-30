import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

// supabase/migrations 의 SQL 을 PGlite(WASM 으로 돌리는 실제 Postgres)에서 순서대로 실행해 RLS·권한을 검증한다.
// Supabase 가 미리 만들어 두는 것(anon·authenticated 역할, auth 스키마, 기본 권한)만 최소한으로 흉내 낸다.
// PostgREST 는 거치지 않으므로, 클라이언트가 보내는 것과 같은 쿼리를 같은 역할로 직접 실행해 확인한다.

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../supabase/migrations");
const MIGRATIONS = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  -- Supabase 의 auth.uid() 처럼 요청의 JWT sub 를 돌려준다
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  -- Supabase 는 public 스키마에 새로 만든 테이블·함수·시퀀스의 권한을 anon·authenticated 에 기본으로 준다
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

const ALICE = "aaaaaaaa-0000-4000-8000-000000000001"; // 매직링크 가입자, 리뷰 작성
const BORA = "bbbbbbbb-0000-4000-8000-000000000002"; // 이름 메타데이터가 있는 가입자, 리뷰 없음
const CHAN = "cccccccc-0000-4000-8000-000000000003"; // 매직링크 가입자, 리뷰 없음

const opened: PGlite[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.close()));
});

async function apply(db: PGlite, file: string) {
  await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
}

// 번호(파일 이름 앞 4자리)가 upTo 이하인 마이그레이션까지 적용한 DB. upTo 를 빼면 전부 적용한다.
async function createDb(upTo = "9999") {
  const db = new PGlite();
  opened.push(db);
  await db.exec(SUPABASE_STUB);
  for (const file of MIGRATIONS.filter((f) => f.slice(0, 4) <= upTo)) await apply(db, file);
  return db;
}

async function signUp(db: PGlite, id: string, email: string, meta: Record<string, string> = {}) {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    id,
    email,
    JSON.stringify(meta),
  ]);
}

// 클라이언트 역할로 실행한다. userId 가 있으면 그 사용자로 로그인한 상태(authenticated)다.
async function asRole<T>(db: PGlite, role: "anon" | "authenticated", userId: string | null, fn: () => Promise<T>) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

async function nicknames(db: PGlite) {
  const { rows } = await db.query<{ id: string; nickname: string }>("select id, nickname from public.profiles order by id");
  return Object.fromEntries(rows.map((r) => [r.id, r.nickname]));
}

async function visibleProfileIds(db: PGlite, role: "anon" | "authenticated", userId: string | null = null) {
  const { rows } = await asRole(db, role, userId, () =>
    db.query<{ id: string }>("select id from public.profiles order by id"),
  );
  return rows.map((r) => r.id);
}

async function writeReview(db: PGlite, userId: string) {
  await asRole(db, "authenticated", userId, () =>
    db.query(
      "insert into public.reviews (target_type, target_id, region, user_id, rating) values ('stop', 's1', 'gyeonggi', $1, 5)",
      [userId],
    ),
  );
}

describe("마이그레이션 (PGlite 에서 실제로 실행)", () => {
  it("createDb 는 번호가 upTo 이하인 마이그레이션까지 적용한다", async () => {
    const db = await createDb("0005");
    // 0005 가 적용됐으면 bus_targets 에 RLS 가 켜져 있고, 0006 의 함수는 아직 없다
    const { rows } = await db.query<{ rls: boolean; fn: string | null }>(
      "select (select relrowsecurity from pg_class where oid = 'public.bus_targets'::regclass) as rls, to_regproc('public.default_nickname')::text as fn",
    );
    expect(rows[0]).toEqual({ rls: true, fn: null });
  });

  it("0006: 매직링크 가입자의 이메일 앞부분 닉네임과 빈 닉네임을 기본 닉네임으로 바꾸고, 이름이 있는 가입자는 그대로 둔다", async () => {
    const db = await createDb("0005");
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com", { name: "김보라" });
    await signUp(db, CHAN, "chan@example.com", { name: "  " });
    expect(await nicknames(db)).toEqual({ [ALICE]: "alice", [BORA]: "김보라", [CHAN]: "  " });

    await apply(db, "0006_nickname_without_email.sql");
    expect(await nicknames(db)).toEqual({ [ALICE]: "익명-aaaaaa", [BORA]: "김보라", [CHAN]: "익명-cccccc" });

    // 0006 뒤에 가입한 사람도 이메일 앞부분을 쓰지 않는다
    const dan = "dddddddd-0000-4000-8000-000000000004";
    await signUp(db, dan, "dan@example.com");
    expect((await nicknames(db))[dan]).toBe("익명-dddddd");
  });

  it("0007 전에는 공개 키로 모든 가입자의 프로필이 보였다", async () => {
    const db = await createDb("0006");
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com", { name: "김보라" });
    expect(await visibleProfileIds(db, "anon")).toEqual([ALICE, BORA]);
  });

  it("0007: 공개 키(anon)로는 리뷰를 쓴 사람의 프로필만 보이고, 리뷰에 작성자 닉네임을 붙여 읽을 수 있다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com", { name: "김보라" });
    await writeReview(db, ALICE);

    expect(await visibleProfileIds(db, "anon")).toEqual([ALICE]);

    // 리뷰 목록(useReviews)이 하는 것처럼 리뷰에 작성자 닉네임·아바타를 붙인다
    const reviews = await asRole(db, "anon", null, () =>
      db.query<{ nickname: string }>(
        "select r.id, p.nickname, p.avatar_url from public.reviews r left join public.profiles p on p.id = r.user_id",
      ),
    );
    expect(reviews.rows.map((r) => r.nickname)).toEqual(["익명-aaaaaa"]);
  });

  it("0007: 로그인한 사용자는 리뷰를 쓴 사람의 프로필과 자기 프로필을 읽는다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com", { name: "김보라" });
    await signUp(db, CHAN, "chan@example.com");
    await writeReview(db, ALICE);

    expect(await visibleProfileIds(db, "authenticated", CHAN)).toEqual([ALICE, CHAN]);
  });

  it("0007: 다른 이름의 '전체 공개' SELECT 정책이 남아 있어도 지우고 하나만 남긴다", async () => {
    const db = await createDb("0006");
    // Supabase 대시보드의 프로필 템플릿이 만드는 정책과 같은 모양
    await db.exec(`create policy "Public profiles are viewable by everyone." on public.profiles for select using (true)`);
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com");
    await writeReview(db, ALICE);

    await apply(db, "0007_profiles_select_policy.sql");
    expect(await visibleProfileIds(db, "anon")).toEqual([ALICE]);
    const { rows } = await db.query<{ policyname: string }>(
      "select policyname from pg_policies where tablename = 'profiles' and cmd = 'SELECT'",
    );
    expect(rows.map((r) => r.policyname)).toEqual(["profiles of reviewers and self are viewable"]);
  });

  it("리뷰는 본인 이름으로만 쓸 수 있다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com");
    await expect(
      asRole(db, "authenticated", BORA, () =>
        db.query(
          "insert into public.reviews (target_type, target_id, region, user_id, rating) values ('stop', 's1', 'gyeonggi', $1, 1)",
          [ALICE],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("0005: 옛 0001 로 만들어 공개 키로 열려 있던 bus_targets 를 막는다", async () => {
    const db = await createDb("0004");
    // 지금의 0001 은 처음부터 막아 두므로, 옛 0001 로 만든 DB 처럼 다시 연다
    await db.exec(`
      alter table public.bus_targets disable row level security;
      grant all on table public.bus_targets to anon, authenticated;
    `);
    const insert = "insert into public.bus_targets (target_type, target_id, region) values ('stop', 's1', 'gyeonggi')";
    await asRole(db, "anon", null, () => db.query(insert));

    await apply(db, "0005_bus_targets_rls.sql");
    await expect(asRole(db, "anon", null, () => db.query("select * from public.bus_targets"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(asRole(db, "anon", null, () => db.query(insert))).rejects.toThrow(/permission denied/);
  });

  it("0004 이후 마이그레이션은 다시 실행해도 오류 없이 같은 결과가 된다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com");
    await writeReview(db, ALICE);
    for (const file of MIGRATIONS.filter((f) => f.slice(0, 4) >= "0004")) await apply(db, file);

    expect(await nicknames(db)).toEqual({ [ALICE]: "익명-aaaaaa", [BORA]: "익명-bbbbbb" });
    expect(await visibleProfileIds(db, "anon")).toEqual([ALICE]);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_policies where tablename = 'profiles' and cmd = 'SELECT'",
    );
    expect(rows[0]?.n).toBe(1);
  });
});

describe("0008 리뷰 남용 막기", () => {
  // 앱(useAddReview)의 upsert 를 PostgREST 가 바꾼 쿼리와 같은 모양: 보낸 열을 모두 SET 한다
  const upsertReview = (db: PGlite, userId: string, rating: number, content: string) =>
    asRole(db, "authenticated", userId, () =>
      db.query(
        `insert into public.reviews (target_type, target_id, region, rating, content, tags, user_id)
         values ('stop', 's1', 'gyeonggi', $2, $3, '{}', $1)
         on conflict (user_id, target_type, target_id)
         do update set target_type = excluded.target_type, target_id = excluded.target_id, region = excluded.region,
           rating = excluded.rating, content = excluded.content, tags = excluded.tags, user_id = excluded.user_id`,
        [userId, rating, content],
      ),
    );

  it("같은 사람이 같은 대상에 리뷰를 또 넣으면 거절하고, upsert 로는 그 리뷰를 고친다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com");
    await writeReview(db, ALICE);
    await expect(writeReview(db, ALICE)).rejects.toThrow(/reviews_user_target_key/);

    await upsertReview(db, ALICE, 1, "고친 리뷰");
    await writeReview(db, BORA); // 다른 사람은 같은 대상에 쓸 수 있다
    const { rows } = await db.query("select user_id, rating, content from public.reviews order by user_id");
    expect(rows).toEqual([
      { user_id: ALICE, rating: 1, content: "고친 리뷰" },
      { user_id: BORA, rating: 5, content: null },
    ]);
  });

  it("작성 시각은 서버가 정하고, 고쳐도 바뀌지 않는다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await asRole(db, "authenticated", ALICE, () =>
      db.query(
        "insert into public.reviews (target_type, target_id, region, user_id, rating, created_at, updated_at) values ('stop', 's1', 'gyeonggi', $1, 5, '2999-12-31', '2999-12-31')",
        [ALICE],
      ),
    );
    const before = await db.query<{ created_at: Date }>("select created_at from public.reviews");
    expect(before.rows[0]!.created_at.getUTCFullYear()).toBeLessThan(2999);

    await asRole(db, "authenticated", ALICE, () =>
      db.query("update public.reviews set created_at = '2999-12-31', content = '고침' where user_id = $1", [ALICE]),
    );
    await upsertReview(db, ALICE, 3, "다시 고침");
    const after = await db.query<{ created_at: Date; updated_at: Date }>("select created_at, updated_at from public.reviews");
    expect(after.rows[0]!.created_at).toEqual(before.rows[0]!.created_at);
    expect(after.rows[0]!.updated_at.getUTCFullYear()).toBeLessThan(2999);
  });

  it("본문 1000자·닉네임 30자를 넘으면 거절하고, 가입 때 긴 이름은 30자로 자른다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await upsertReview(db, ALICE, 5, "가".repeat(1000));
    await expect(upsertReview(db, ALICE, 5, "가".repeat(1001))).rejects.toThrow(/reviews_content_length/);
    await expect(
      asRole(db, "authenticated", ALICE, () =>
        db.query("update public.profiles set nickname = repeat('가', 31) where id = $1", [ALICE]),
      ),
    ).rejects.toThrow(/profiles_nickname_length/);

    await signUp(db, BORA, "bora@example.com", { name: "보".repeat(40) });
    expect((await nicknames(db))[BORA]).toBe("보".repeat(30));
  });

  it("같은 사람·대상 리뷰가 이미 여럿이면 아무것도 바꾸지 않고 멈춘다", async () => {
    const db = await createDb("0007");
    await signUp(db, ALICE, "alice@example.com");
    await writeReview(db, ALICE);
    await writeReview(db, ALICE);

    await expect(apply(db, "0008_review_limits.sql")).rejects.toThrow(/1 쌍/);
    const { rows } = await db.query<{ idx: string | null }>("select to_regclass('public.reviews_user_target_key')::text as idx");
    expect(rows[0]!.idx).toBeNull();
  });

  it("이미 긴 본문이 있어도 적용되고, 그 행은 그대로 남는다", async () => {
    const db = await createDb("0007");
    await signUp(db, ALICE, "alice@example.com");
    await asRole(db, "authenticated", ALICE, () =>
      db.query(
        "insert into public.reviews (target_type, target_id, region, user_id, rating, content) values ('stop', 's1', 'gyeonggi', $1, 5, repeat('가', 5000))",
        [ALICE],
      ),
    );
    await apply(db, "0008_review_limits.sql");
    const { rows } = await db.query<{ n: number }>("select char_length(content) as n from public.reviews");
    expect(rows[0]!.n).toBe(5000);
  });

  it("이미 미래로 넣어 둔 작성 시각은 지금으로 바로잡고, 관리자(postgres)는 작성 시각을 고칠 수 있다", async () => {
    const db = await createDb("0007");
    await signUp(db, ALICE, "alice@example.com");
    await asRole(db, "authenticated", ALICE, () =>
      db.query(
        "insert into public.reviews (target_type, target_id, region, user_id, rating, created_at) values ('stop', 's1', 'gyeonggi', $1, 5, '2999-12-31')",
        [ALICE],
      ),
    );
    await apply(db, "0008_review_limits.sql");
    const fixed = await db.query<{ future: boolean }>("select created_at > now() as future from public.reviews");
    expect(fixed.rows[0]!.future).toBe(false);

    // 앱 역할로는 못 바꾸지만, 관리자 작업은 트리거가 막지 않는다
    await db.query("update public.reviews set created_at = '2020-01-01'");
    const admin = await db.query<{ y: number }>("select extract(year from created_at)::int as y from public.reviews");
    expect(admin.rows[0]!.y).toBe(2020);
  });

  it("아바타 주소는 500자 상한이고 가입 때 잘라 넣으며, 중복이 된 reviews_user_idx 는 지운다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com", { avatar_url: "https://a.example/" + "x".repeat(1000) });
    const { rows } = await db.query<{ n: number; idx: string | null }>(
      "select char_length(avatar_url) as n, to_regclass('public.reviews_user_idx')::text as idx from public.profiles",
    );
    expect(rows[0]).toEqual({ n: 500, idx: null });
    await expect(
      asRole(db, "authenticated", ALICE, () =>
        db.query("update public.profiles set avatar_url = repeat('x', 501) where id = $1", [ALICE]),
      ),
    ).rejects.toThrow(/profiles_avatar_url_length/);
  });
});
