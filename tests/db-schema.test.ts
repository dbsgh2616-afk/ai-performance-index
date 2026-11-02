// 작업 1·2: 표 구조의 제약조건과 시드가 설계(DESIGN 6장, 10.3)대로 동작하는지 확인한다.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { verifyPassword } from "../lib/auth/password";
import { accounts, changeLogs, monthlyInputs, services, surveySettings } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import { seedDev } from "../lib/db/seed-dev";
import type { AppDb } from "../lib/db/types";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(async () => {
  await close();
});

describe("운영 시드", () => {
  it("서비스 6개와 첫 관리자 1개를 넣고, 다시 실행해도 늘어나지 않는다", async () => {
    const first = await seedBase(db, { loginId: "admin01", password: "Passw0rdOk" });
    expect(first).toEqual({ serviceCount: 6, adminCreated: true });

    const second = await seedBase(db, { loginId: "admin01", password: "Passw0rdOk" });
    expect(second).toEqual({ serviceCount: 6, adminCreated: false });

    const [admin] = await db.select().from(accounts).where(eq(accounts.loginId, "admin01"));
    expect(admin.role).toBe("admin");
    expect(admin.passwordHash).not.toBe("Passw0rdOk");
    expect(await verifyPassword("Passw0rdOk", admin.passwordHash)).toBe(true);
  });

  it("비밀번호 규칙을 어기면 거부한다", async () => {
    await expect(seedBase(db, { loginId: "x", password: "short1" })).rejects.toThrow("8자 이상");
    await expect(seedBase(db, { loginId: "x", password: "onlyletters" })).rejects.toThrow("영문과 숫자");
  });
});

describe("DB 제약조건", () => {
  it("서비스는 6개를 넘을 수 없다", async () => {
    await expect(db.insert(services).values({ name: "일곱 번째", sortOrder: 7 })).rejects.toThrow();
    await expect(db.insert(services).values({ name: "겹침", sortOrder: 1 })).rejects.toThrow();
  });

  it("호출횟수는 0 이상이고 근거 등급은 실측만 허용한다", async () => {
    const [service] = await db.select().from(services).limit(1);
    const [admin] = await db.select().from(accounts).limit(1);
    const base = {
      serviceId: service.id,
      yearMonth: "2026-01",
      enteredById: admin.id,
      enteredByName: admin.name,
    };
    await expect(db.insert(monthlyInputs).values({ ...base, callCount: -1 })).rejects.toThrow();
    await expect(
      db.insert(monthlyInputs).values({ ...base, callCount: 10, evidenceGrade: "설문 추정" }),
    ).rejects.toThrow();
    await expect(db.insert(monthlyInputs).values({ ...base, yearMonth: "2026-13", callCount: 10 })).rejects.toThrow();
  });

  it("같은 서비스·같은 달은 두 번 넣을 수 없다", async () => {
    const [service] = await db.select().from(services).limit(1);
    const [admin] = await db.select().from(accounts).limit(1);
    const row = {
      serviceId: service.id,
      yearMonth: "2026-02",
      callCount: 5,
      enteredById: admin.id,
      enteredByName: admin.name,
    };
    await db.insert(monthlyInputs).values(row);
    await expect(db.insert(monthlyInputs).values(row)).rejects.toThrow();
  });

  it("설문 설정값은 설문 추정만 허용하고 범위를 지킨다", async () => {
    const [service] = await db.select().from(services).limit(1);
    const [admin] = await db.select().from(accounts).limit(1);
    const base = {
      serviceId: service.id,
      year: 2030,
      half: "H1" as const,
      savedMinutes: 5,
      contributionPct: 90,
      correctionFactor: 1,
      enteredById: admin.id,
      enteredByName: admin.name,
    };
    await expect(db.insert(surveySettings).values({ ...base, evidenceGrade: "실측" })).rejects.toThrow();
    await expect(db.insert(surveySettings).values({ ...base, contributionPct: 101 })).rejects.toThrow();
    await expect(db.insert(surveySettings).values({ ...base, correctionFactor: 0 })).rejects.toThrow();
  });

  it("입력자 번호는 계정과 연결되지 않아, 계정을 지워도 기록이 남는다", async () => {
    const [service] = await db.select().from(services).limit(1);
    await db.insert(accounts).values({
      loginId: "temp-user",
      name: "임시",
      role: "viewer",
      passwordHash: "x",
    });
    const [temp] = await db.select().from(accounts).where(eq(accounts.loginId, "temp-user"));
    await db.insert(monthlyInputs).values({
      serviceId: service.id,
      yearMonth: "2026-03",
      callCount: 1,
      enteredById: temp.id,
      enteredByName: temp.name,
    });
    await db.delete(accounts).where(eq(accounts.id, temp.id));
    const [kept] = await db.select().from(monthlyInputs).where(eq(monthlyInputs.yearMonth, "2026-03"));
    expect(kept.enteredByName).toBe("임시");
  });
});

describe("변경 이력", () => {
  it("쌓을 수는 있지만 수정하거나 지울 수 없다", async () => {
    await db.insert(changeLogs).values({
      targetType: "monthly_input",
      targetId: "1",
      fieldName: "call_count",
      oldValue: "1",
      newValue: "2",
      changedByName: "관리자",
    });
    await expect(db.update(changeLogs).set({ newValue: "3" })).rejects.toThrow();
    await expect(db.delete(changeLogs)).rejects.toThrow();
  });
});

describe("개발용 시드", () => {
  it("시험 데이터를 넣고, 다시 실행해도 늘어나지 않는다", async () => {
    const result = await seedDev(db);
    expect(result.settingCount).toBe(12);
    const again = await seedDev(db);
    expect(again.settingCount).toBe(12);
    const rows = await db.select().from(surveySettings).where(eq(surveySettings.year, 2026));
    expect(rows).toHaveLength(12);
  });
});
