// Design Ref: §10.3 시드 데이터 — 운영 시드는 services 6개와 첫 관리자 1개뿐이다.
// 개발용 시험 데이터(monthly_inputs, survey_settings)는 seed-dev.ts로 분리하고 운영 DB에는 넣지 않는다.
import { eq, sql } from "drizzle-orm";

import { hashPassword, isValidPassword, PASSWORD_RULE_MESSAGE } from "../auth/password";
import { accounts, services } from "./schema";
import { SERVICE_NAMES } from "./seed-data";
import type { AppDb } from "./types";

export type SeedAdmin = {
  loginId: string;
  password: string;
  name?: string;
};

export type SeedResult = {
  serviceCount: number;
  adminCreated: boolean;
};

// 여러 번 실행해도 안전하다. 서비스는 순서 번호를 기준으로 이름만 갱신하고,
// 관리자는 이미 한 명이라도 있으면 새로 만들지 않는다.
export async function seedBase(db: AppDb, admin: SeedAdmin): Promise<SeedResult> {
  if (!admin.loginId.trim()) {
    throw new Error("첫 관리자 아이디가 비어 있습니다.");
  }
  if (!isValidPassword(admin.password)) {
    throw new Error(`첫 관리자 비밀번호 규칙을 지켜 주세요. ${PASSWORD_RULE_MESSAGE}`);
  }

  await db
    .insert(services)
    .values(SERVICE_NAMES.map((name, index) => ({ name, sortOrder: index + 1 })))
    .onConflictDoUpdate({ target: services.sortOrder, set: { name: sql`excluded.name` } });

  const existingAdmin = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.role, "admin"))
    .limit(1);

  let adminCreated = false;
  if (existingAdmin.length === 0) {
    await db.insert(accounts).values({
      loginId: admin.loginId.trim(),
      name: admin.name?.trim() || "관리자",
      role: "admin",
      passwordHash: await hashPassword(admin.password),
    });
    adminCreated = true;
  }

  const serviceRows = await db.select({ id: services.id }).from(services);
  return { serviceCount: serviceRows.length, adminCreated };
}
