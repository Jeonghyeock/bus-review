import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

// supabase/migrations 의 SQL 을 PGlite(WASM 으로 돌리는 실제 Postgres)에서 순서대로 실행해 RLS·권한을 검증한다.
// Supabase 가 미리 만들어 두는 것(anon·authenticated 역할, auth 스키마, 기본 권한)만 최소한으로 흉내 낸다.
// PostgREST 는 거치지 않으므로, 클라이언트가 보내는 것과 같은 쿼리를 같은 역할로 직접 실행해 확인한다.

const MIGRATIONS_DIR = path.resolve(__dirname, "../supabase/migrations");
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

async function apply(db: PGlite, file: string) {
  await db.exec(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
}

// 이름이 upTo 이하인 마이그레이션까지 적용한 DB (upTo 를 빼면 전부)
async function createDb(upTo = "9999") {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of MIGRATIONS.filter((f) => f <= upTo)) await apply(db, file);
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

async function writeReview(db: PGlite, userId: string) {
  await asRole(db, "authenticated", userId, () =>
    db.query(
      "insert into public.reviews (target_type, target_id, region, user_id, rating) values ('stop', 's1', 'gyeonggi', $1, 5)",
      [userId],
    ),
  );
}

describe("마이그레이션 (PGlite 에서 실제로 실행)", () => {
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

  it("0007: 공개 키(anon)로는 리뷰를 쓴 사람의 프로필만, id·닉네임·아바타만 읽는다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await signUp(db, BORA, "bora@example.com", { name: "김보라" });
    await writeReview(db, ALICE);

    const visible = await asRole(db, "anon", null, () =>
      db.query<{ id: string }>("select id, nickname, avatar_url from public.profiles"),
    );
    expect(visible.rows.map((r) => r.id)).toEqual([ALICE]);

    await expect(asRole(db, "anon", null, () => db.query("select created_at from public.profiles"))).rejects.toThrow(
      /permission denied/,
    );

    // 리뷰 목록(useReviews)이 하는 것처럼 리뷰에 작성자 닉네임을 붙여 읽을 수 있다
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

    const visible = await asRole(db, "authenticated", CHAN, () =>
      db.query<{ id: string }>("select id from public.profiles order by id"),
    );
    expect(visible.rows.map((r) => r.id)).toEqual([ALICE, CHAN]);
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

  it("0005: 공개 키로는 쓰지 않는 bus_targets 를 읽지도 쓰지도 못한다", async () => {
    const db = await createDb();
    await expect(asRole(db, "anon", null, () => db.query("select * from public.bus_targets"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asRole(db, "anon", null, () =>
        db.query("insert into public.bus_targets (target_type, target_id, region) values ('stop', 's1', 'gyeonggi')"),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("0004 이후 마이그레이션은 다시 실행해도 오류 없이 같은 결과가 된다", async () => {
    const db = await createDb();
    await signUp(db, ALICE, "alice@example.com");
    await writeReview(db, ALICE);
    for (const file of MIGRATIONS.filter((f) => f >= "0004")) await apply(db, file);

    expect(await nicknames(db)).toEqual({ [ALICE]: "익명-aaaaaa" });
    const visible = await asRole(db, "anon", null, () => db.query<{ id: string }>("select id from public.profiles"));
    expect(visible.rows.map((r) => r.id)).toEqual([ALICE]);
  });
});
