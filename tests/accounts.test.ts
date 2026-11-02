// 작업 13: 계정 추가·삭제·비밀번호 재설정, 마지막 관리자 보호, 변경 이력 화면용 조회를 확인한다.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAccount, deleteAccount, listAccounts, MESSAGES, resetPassword } from "../lib/accounts";
import { authenticate } from "../lib/auth/login";
import { verifyPassword } from "../lib/auth/password";
import { accounts, changeLogs, monthlyInputs, services } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import type { AppDb } from "../lib/db/types";
import { loadHistory } from "../lib/history";
import { saveMonthlyInputs } from "../lib/inputs";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;
const actor = { id: 1, name: "김관리" };

async function idOf(loginId: string): Promise<number> {
  const [row] = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.loginId, loginId));
  return row.id;
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedBase(db, { loginId: "admin01", password: "Passw0rd1" });
});

afterAll(async () => {
  await close();
});

describe("계정 추가", () => {
  it("계정을 만들고, 비밀번호는 섞어 저장하며, 이력에는 비밀번호를 남기지 않는다", async () => {
    const result = await createAccount(db, { loginId: "viewer01", name: "조회자1", role: "viewer", password: "Viewer1234" }, actor);
    expect(result).toEqual({ ok: true });

    const [row] = await db.select().from(accounts).where(eq(accounts.loginId, "viewer01"));
    expect(row.role).toBe("viewer");
    expect(row.passwordHash).not.toContain("Viewer1234");
    expect(await verifyPassword("Viewer1234", row.passwordHash)).toBe(true);

    const logs = await db.select().from(changeLogs).where(eq(changeLogs.targetId, "viewer01"));
    expect(logs.map((log) => log.fieldName).sort()).toEqual(["login_id", "name", "role"]);
    expect(JSON.stringify(logs)).not.toContain("Viewer1234");
  });

  it("같은 아이디, 약한 비밀번호, 잘못된 권한·아이디는 거부한다", async () => {
    expect(await createAccount(db, { loginId: "viewer01", name: "중복", role: "viewer", password: "Viewer1234" }, actor)).toEqual({
      ok: false,
      error: MESSAGES.duplicate,
    });
    expect(await createAccount(db, { loginId: "weak01", name: "약함", role: "viewer", password: "short1" }, actor)).toEqual({
      ok: false,
      error: MESSAGES.password,
    });
    expect(await createAccount(db, { loginId: "ab", name: "짧음", role: "viewer", password: "Viewer1234" }, actor)).toMatchObject({ ok: false });
    expect(await createAccount(db, { loginId: "bad id!", name: "공백", role: "viewer", password: "Viewer1234" }, actor)).toMatchObject({ ok: false });
    expect(await createAccount(db, { loginId: "root01", name: "권한", role: "superuser", password: "Viewer1234" }, actor)).toMatchObject({ ok: false });
  });
});

describe("비밀번호 재설정", () => {
  it("새 비밀번호로 바뀌고, 세션 번호가 오르고, 로그인 잠금이 풀린다", async () => {
    const id = await idOf("viewer01");
    // 일부러 잠가 둔다.
    await db.update(accounts).set({ failedCount: 3, lockedUntil: new Date(Date.now() + 600_000) }).where(eq(accounts.id, id));
    const [before] = await db.select().from(accounts).where(eq(accounts.id, id));

    expect(await resetPassword(db, id, "weak", actor)).toEqual({ ok: false, error: MESSAGES.password });
    expect(await resetPassword(db, id, "NewPass5678", actor)).toEqual({ ok: true });

    const [after] = await db.select().from(accounts).where(eq(accounts.id, id));
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(after.failedCount).toBe(0);
    expect(after.lockedUntil).toBeNull();

    expect((await authenticate(db, "viewer01", "NewPass5678")).ok).toBe(true);
    expect((await authenticate(db, "viewer01", "Viewer1234")).ok).toBe(false);

    const logs = await db.select().from(changeLogs).where(eq(changeLogs.fieldName, "password"));
    expect(logs).toHaveLength(1);
    expect(JSON.stringify(logs)).not.toContain("NewPass5678");
  });

  it("없는 계정은 오류다", async () => {
    expect(await resetPassword(db, 99999, "NewPass5678", actor)).toEqual({ ok: false, error: MESSAGES.notFound });
  });
});

describe("계정 삭제와 마지막 관리자 보호", () => {
  it("마지막 관리자는 삭제할 수 없다", async () => {
    const adminId = await idOf("admin01");
    expect(await deleteAccount(db, adminId, actor)).toEqual({ ok: false, error: MESSAGES.lastAdmin });
    expect((await listAccounts(db)).some((row) => row.loginId === "admin01")).toBe(true);
  });

  it("관리자가 둘이면 하나는 지울 수 있지만, 남은 한 명은 다시 막힌다", async () => {
    await createAccount(db, { loginId: "admin02", name: "관리자2", role: "admin", password: "Admin2Pass9" }, actor);
    const second = await idOf("admin02");
    expect(await deleteAccount(db, second, actor)).toEqual({ ok: true });
    expect(await deleteAccount(db, await idOf("admin01"), actor)).toEqual({ ok: false, error: MESSAGES.lastAdmin });
  });

  it("계정을 지워도 그 계정이 남긴 입력 기록(입력자 이름)과 이력은 남는다", async () => {
    await createAccount(db, { loginId: "writer01", name: "입력자", role: "viewer", password: "Writer1234" }, actor);
    const writerId = await idOf("writer01");
    const [service] = await db.select().from(services).limit(1);
    await saveMonthlyInputs(
      db,
      { yearMonth: "2026-05", rows: [{ serviceId: service.id, callCount: 10, source: "x" }], security: { incident: false, source: null } },
      { id: writerId, name: "입력자" },
    );

    expect(await deleteAccount(db, writerId, actor)).toEqual({ ok: true });
    expect(await deleteAccount(db, writerId, actor)).toEqual({ ok: false, error: MESSAGES.notFound });

    const [input] = await db.select().from(monthlyInputs).where(eq(monthlyInputs.yearMonth, "2026-05"));
    expect(input.enteredByName).toBe("입력자");
    const logs = await db.select().from(changeLogs).where(eq(changeLogs.changedByName, "입력자"));
    expect(logs.length).toBeGreaterThan(0);
  });
});

describe("변경 이력 조회", () => {
  it("대상으로 걸러지고, 항목과 대상 이름이 한국어로 나온다", async () => {
    const all = await loadHistory(db);
    expect(all.length).toBeGreaterThan(5);

    const onlyAccounts = await loadHistory(db, { target: "account" });
    expect(onlyAccounts.every((row) => row.target === "계정")).toBe(true);
    expect(onlyAccounts.some((row) => row.field === "권한" && row.newValue === "관리자")).toBe(true);

    const inputs = await loadHistory(db, { target: "monthly_input" });
    expect(inputs[0]).toMatchObject({ field: expect.any(String), changedByName: "입력자" });
    expect(inputs[0].object).toContain("AI 서비스 1");
  });

  it("기간으로 걸러진다 (한국 시간 기준)", async () => {
    const future = await loadHistory(db, { from: "2999-01-01" });
    expect(future).toHaveLength(0);
    const past = await loadHistory(db, { to: "2000-01-01" });
    expect(past).toHaveLength(0);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const now = await loadHistory(db, { from: today, to: today });
    expect(now.length).toBeGreaterThan(0);
  });
});
