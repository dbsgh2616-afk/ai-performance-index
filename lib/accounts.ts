// Design Ref: §4.9 계정 관리, §9 보안 — 관리자가 계정을 추가·삭제하고 비밀번호를 다시 설정한다.
// Plan SC: FR-13 마지막 관리자는 삭제할 수 없다. 계정을 삭제해도 이력의 입력자 이름은 남는다.
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { hashPassword, isValidPassword, PASSWORD_RULE_MESSAGE } from "./auth/password";
import { recordChanges } from "./changelog";
import { accounts } from "./db/schema";
import type { AppDb } from "./db/types";
import type { Actor } from "./inputs";

export type AccountResult = { ok: true } | { ok: false; error: string };

export type AccountRow = {
  id: number;
  loginId: string;
  name: string;
  role: "admin" | "viewer";
  createdAt: Date;
};

const createSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(3, "아이디는 3자 이상이어야 합니다.")
    .max(50, "아이디는 50자 이하여야 합니다.")
    .regex(/^[A-Za-z0-9._-]+$/, "아이디는 영문, 숫자, . _ - 만 쓸 수 있습니다."),
  name: z.string().trim().min(1, "이름을 입력하세요.").max(50, "이름은 50자 이하여야 합니다."),
  role: z.enum(["admin", "viewer"], { error: "권한을 선택하세요." }),
});

export const MESSAGES = {
  duplicate: "이미 있는 아이디입니다.",
  lastAdmin: "마지막 관리자는 삭제할 수 없습니다.",
  notFound: "계정을 찾을 수 없습니다.",
  password: PASSWORD_RULE_MESSAGE,
} as const;

export async function listAccounts(db: AppDb): Promise<AccountRow[]> {
  return db
    .select({
      id: accounts.id,
      loginId: accounts.loginId,
      name: accounts.name,
      role: accounts.role,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .orderBy(asc(accounts.id));
}

export async function createAccount(
  db: AppDb,
  input: { loginId: string; name: string; role: string; password: string },
  actor: Actor,
): Promise<AccountResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  // 비밀번호 규칙은 서버에서 검사한다. (DESIGN 4.9)
  if (!isValidPassword(input.password)) return { ok: false, error: MESSAGES.password };

  const passwordHash = await hashPassword(input.password);

  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.loginId, parsed.data.loginId));
    if (existing) return { ok: false, error: MESSAGES.duplicate } as const;

    await tx.insert(accounts).values({ ...parsed.data, passwordHash });
    // 비밀번호는 이력에 남기지 않는다.
    await recordChanges(tx, {
      targetType: "account",
      targetId: parsed.data.loginId,
      changedByName: actor.name,
      before: null,
      after: { login_id: parsed.data.loginId, name: parsed.data.name, role: parsed.data.role },
    });
    return { ok: true } as const;
  });
}

// 비밀번호를 다시 설정하면 세션 번호가 올라가서 그 계정의 열려 있던 세션이 끊긴다. 로그인 잠금도 풀린다.
export async function resetPassword(
  db: AppDb,
  accountId: number,
  newPassword: string,
  actor: Actor,
): Promise<AccountResult> {
  if (!isValidPassword(newPassword)) return { ok: false, error: MESSAGES.password };
  const passwordHash = await hashPassword(newPassword);

  return db.transaction(async (tx) => {
    const [target] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for("update");
    if (!target) return { ok: false, error: MESSAGES.notFound } as const;

    await tx
      .update(accounts)
      .set({
        passwordHash,
        sessionVersion: sql`${accounts.sessionVersion} + 1`,
        failedCount: 0,
        lockedUntil: null,
      })
      .where(eq(accounts.id, accountId));

    await recordChanges(tx, {
      targetType: "account",
      targetId: target.loginId,
      changedByName: actor.name,
      before: { password: "설정됨" },
      after: { password: "다시 설정됨" },
    });
    return { ok: true } as const;
  });
}

// 마지막 관리자는 삭제할 수 없다. 두 사람이 동시에 지워도 막히도록, 관리자 행을 먼저 잠근 뒤 센다.
export async function deleteAccount(db: AppDb, accountId: number, actor: Actor): Promise<AccountResult> {
  return db.transaction(async (tx) => {
    const admins = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.role, "admin")).for("update");
    const [target] = await tx.select().from(accounts).where(eq(accounts.id, accountId)).for("update");
    if (!target) return { ok: false, error: MESSAGES.notFound } as const;

    if (target.role === "admin" && admins.length <= 1) {
      return { ok: false, error: MESSAGES.lastAdmin } as const;
    }

    await tx.delete(accounts).where(eq(accounts.id, accountId));
    // 입력 기록의 입력자 번호는 계정과 연결되지 않고 이름이 복사돼 있어서, 계정을 지워도 기록이 남는다.
    await recordChanges(tx, {
      targetType: "account",
      targetId: target.loginId,
      changedByName: actor.name,
      before: { login_id: target.loginId, name: target.name, role: target.role },
      after: { login_id: null, name: null, role: null },
    });
    return { ok: true } as const;
  });
}
