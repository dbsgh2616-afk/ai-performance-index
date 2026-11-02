// 작업 3~5: 로그인 잠금, 세션 증표, 비밀번호 규칙이 설계(DESIGN 5.3, 9장)대로 동작하는지 확인한다.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authenticate, LOCK_MINUTES, MAX_FAILED_LOGINS } from "../lib/auth/login";
import { hashPassword, isValidPassword } from "../lib/auth/password";
import { createSessionToken, verifySessionToken } from "../lib/auth/session";
import { accounts } from "../lib/db/schema";
import type { AppDb } from "../lib/db/types";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-1234";
  ({ db, close } = await createTestDb());
  await db.insert(accounts).values({
    loginId: "tester",
    name: "시험",
    role: "viewer",
    passwordHash: await hashPassword("Correct1234"),
  });
});

afterAll(async () => {
  await close();
});

async function getTester() {
  const [row] = await db.select().from(accounts).where(eq(accounts.loginId, "tester"));
  return row;
}

describe("비밀번호 규칙", () => {
  it("8자 이상, 영문+숫자를 모두 포함해야 한다", () => {
    expect(isValidPassword("abc12345")).toBe(true);
    expect(isValidPassword("abc1234")).toBe(false); // 7자
    expect(isValidPassword("abcdefgh")).toBe(false); // 숫자 없음
    expect(isValidPassword("12345678")).toBe(false); // 영문 없음
  });
});

describe("로그인과 잠금", () => {
  it("맞는 정보로 로그인하면 성공하고 실패 횟수가 0이다", async () => {
    const result = await authenticate(db, "tester", "Correct1234");
    expect(result.ok).toBe(true);
    expect((await getTester()).failedCount).toBe(0);
  });

  it("없는 아이디와 틀린 비밀번호는 같은 오류(invalid)다", async () => {
    expect(await authenticate(db, "nobody", "Whatever123")).toEqual({ ok: false, reason: "invalid" });
    expect(await authenticate(db, "tester", "Wrong12345")).toEqual({ ok: false, reason: "invalid" });
  });

  it("5회 연속 실패하면 15분 잠기고, 맞는 비밀번호도 막힌다", async () => {
    const start = new Date("2026-11-02T10:00:00Z");
    let last;
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      last = await authenticate(db, "tester", "Wrong12345", start);
    }
    expect(last).toMatchObject({ ok: false, reason: "locked" });

    // 잠긴 동안에는 맞는 비밀번호도 거부한다.
    const during = await authenticate(db, "tester", "Correct1234", new Date(start.getTime() + 5 * 60_000));
    expect(during).toMatchObject({ ok: false, reason: "locked" });

    // 15분이 지나면 다시 로그인할 수 있고, 잠금이 풀린다.
    const after = await authenticate(db, "tester", "Correct1234", new Date(start.getTime() + (LOCK_MINUTES + 1) * 60_000));
    expect(after.ok).toBe(true);
    const row = await getTester();
    expect(row.lockedUntil).toBeNull();
    expect(row.failedCount).toBe(0);
  });

  it("실패가 쌓여도 한 번 성공하면 횟수가 0으로 돌아간다", async () => {
    await authenticate(db, "tester", "Wrong12345");
    await authenticate(db, "tester", "Wrong12345");
    expect((await getTester()).failedCount).toBe(2);
    await authenticate(db, "tester", "Correct1234");
    expect((await getTester()).failedCount).toBe(0);
  });
});

describe("세션 증표", () => {
  it("만든 증표를 확인하면 계정 번호와 세션 번호가 나온다", async () => {
    const token = await createSessionToken({ accountId: 7, sessionVersion: 3 });
    expect(await verifySessionToken(token)).toEqual({ accountId: 7, sessionVersion: 3 });
  });

  it("고쳐 쓴 증표와 만료된 증표, 빈 증표는 거부한다", async () => {
    const token = await createSessionToken({ accountId: 7, sessionVersion: 3 });
    expect(await verifySessionToken(`${token}x`)).toBeNull();

    const expired = await createSessionToken({ accountId: 7, sessionVersion: 3 }, -60);
    expect(await verifySessionToken(expired)).toBeNull();

    expect(await verifySessionToken(undefined)).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
  });
});
