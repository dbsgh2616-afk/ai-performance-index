// Design Ref: §5.3 로그인 흐름 — 잠금 확인 → 비밀번호 대조 → 실패 횟수 관리
// Plan SC: 7 보안 규칙 — 5회 연속 실패 시 15분 잠금 (계정 단위)
import { eq, sql } from "drizzle-orm";

import { accounts } from "../db/schema";
import type { AppDb } from "../db/types";
import { verifyPassword } from "./password";

export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;

export type LoginAccount = {
  id: number;
  loginId: string;
  name: string;
  role: "admin" | "viewer";
  sessionVersion: number;
};

export type LoginResult =
  | { ok: true; account: LoginAccount }
  | { ok: false; reason: "invalid" | "locked"; lockedUntil?: Date };

// 아이디가 없는 경우에도 같은 시간이 걸리도록 대조할 가짜 해시 (bcrypt 형식)
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8E8B3eC7Lr1sOq1m4b6ZyQeZJZ1u1G";

export async function authenticate(
  db: AppDb,
  loginId: string,
  password: string,
  now: Date = new Date(),
): Promise<LoginResult> {
  const [account] = await db.select().from(accounts).where(eq(accounts.loginId, loginId)).limit(1);

  if (!account) {
    await verifyPassword(password, DUMMY_HASH);
    return { ok: false, reason: "invalid" };
  }

  // 잠긴 계정은 비밀번호가 맞아도 들어올 수 없다.
  if (account.lockedUntil && account.lockedUntil > now) {
    return { ok: false, reason: "locked", lockedUntil: account.lockedUntil };
  }

  const matched = await verifyPassword(password, account.passwordHash);

  if (!matched) {
    const [updated] = await db
      .update(accounts)
      .set({ failedCount: sql`${accounts.failedCount} + 1` })
      .where(eq(accounts.id, account.id))
      .returning({ failedCount: accounts.failedCount });

    if (updated.failedCount >= MAX_FAILED_LOGINS) {
      const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
      await db.update(accounts).set({ failedCount: 0, lockedUntil }).where(eq(accounts.id, account.id));
      return { ok: false, reason: "locked", lockedUntil };
    }
    return { ok: false, reason: "invalid" };
  }

  // 성공하면 실패 횟수와 잠금을 지운다.
  if (account.failedCount !== 0 || account.lockedUntil) {
    await db.update(accounts).set({ failedCount: 0, lockedUntil: null }).where(eq(accounts.id, account.id));
  }

  return {
    ok: true,
    account: {
      id: account.id,
      loginId: account.loginId,
      name: account.name,
      role: account.role,
      sessionVersion: account.sessionVersion,
    },
  };
}
