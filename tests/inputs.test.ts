// 작업 8·9: 입력값 검사, 저장, 변경 이력, 입력자 자동 기록을 확인한다.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { changeLogs, monthlyInputs, monthlySecurity, services, surveySettings } from "../lib/db/schema";
import { seedBase } from "../lib/db/seed";
import type { AppDb } from "../lib/db/types";
import { loadMonthlyForm, loadSettingsForm, saveMonthlyInputs, saveSurveySettings } from "../lib/inputs";
import { parseMonthlyForm, parseSettingsForm } from "../lib/validation/inputs";
import { createTestDb } from "./helpers/db";

let db: AppDb;
let close: () => Promise<void>;
let ids: number[];
const actor = { id: 1, name: "김관리" };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

beforeAll(async () => {
  ({ db, close } = await createTestDb());
  await seedBase(db, { loginId: "admin01", password: "Passw0rd1" });
  ids = (await db.select({ id: services.id }).from(services).orderBy(services.sortOrder)).map((row) => row.id);
});

afterAll(async () => {
  await close();
});

describe("월 입력 검사", () => {
  it("올바른 값은 통과하고, 호출횟수가 빈 서비스는 건너뛴다", () => {
    const result = parseMonthlyForm(
      form({ yearMonth: "2026-11", [`callCount-${ids[0]}`]: "1200", [`source-${ids[0]}`]: "회신 메일", incident: "on" }),
      ids,
    );
    expect(result).toEqual({
      ok: true,
      data: {
        yearMonth: "2026-11",
        rows: [{ serviceId: ids[0], callCount: 1200, source: "회신 메일" }],
        security: { incident: true, source: null },
      },
    });
  });

  it("음수, 소수, 글자와 잘못된 월은 한국어 오류로 거부한다", () => {
    expect(parseMonthlyForm(form({ yearMonth: "2026-11", [`callCount-${ids[0]}`]: "-5" }), ids)).toMatchObject({
      ok: false,
      error: expect.stringContaining("0 이상의 정수"),
    });
    expect(parseMonthlyForm(form({ yearMonth: "2026-11", [`callCount-${ids[1]}`]: "1.5" }), ids)).toMatchObject({ ok: false });
    expect(parseMonthlyForm(form({ yearMonth: "2026-11", [`callCount-${ids[0]}`]: "abc" }), ids)).toMatchObject({ ok: false });
    expect(parseMonthlyForm(form({ yearMonth: "2026-13" }), ids)).toMatchObject({ ok: false, error: expect.stringContaining("월 형식") });
  });
});

describe("설정값 검사", () => {
  // 한 서비스의 모든 칸(점수 값 + 설문 정보)이 채워진 올바른 입력
  function settingsFields(id: number, overrides: Record<string, string> = {}): Record<string, string> {
    return {
      year: "2026",
      half: "H2",
      [`savedMinutes-${id}`]: "5",
      [`contributionPct-${id}`]: "90",
      [`respondentCount-${id}`]: "120",
      [`targetCount-${id}`]: "300",
      [`surveyStart-${id}`]: "2026-12-01",
      [`surveyEnd-${id}`]: "2026-12-12",
      [`aggregation-${id}`]: "median",
      ...overrides,
    };
  }

  it("보정계수가 비면 1로 저장하고, 전부 빈 서비스는 건너뛴다", () => {
    const result = parseSettingsForm(form(settingsFields(ids[0])), ids);
    expect(result).toMatchObject({ ok: true, data: { year: 2026, half: "H2" } });
    if (result.ok) {
      expect(result.data.rows).toHaveLength(1);
      expect(result.data.rows[0]).toMatchObject({
        correctionFactor: 1,
        respondentCount: 120,
        targetCount: 300,
        surveyStart: "2026-12-01",
        aggregation: "median",
        questionText: null,
      });
    }
  });

  it("범위를 벗어나거나 한 값만 채우면 거부한다", () => {
    const id = ids[0];
    expect(parseSettingsForm(form(settingsFields(id, { [`contributionPct-${id}`]: "101" })), ids)).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ year: "2026", half: "H1", [`savedMinutes-${id}`]: "5" }), ids)).toMatchObject({ ok: false });
    expect(parseSettingsForm(form(settingsFields(id, { [`correctionFactor-${id}`]: "0" })), ids)).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ year: "1999", half: "H1" }), ids)).toMatchObject({ ok: false });
    expect(parseSettingsForm(form({ year: "2026", half: "H3" }), ids)).toMatchObject({ ok: false });
  });

  it("설문 정보가 빠지거나 맞지 않으면 한국어 오류로 거부한다", () => {
    const id = ids[0];
    const error = (overrides: Record<string, string>) => {
      const result = parseSettingsForm(form(settingsFields(id, overrides)), ids);
      return result.ok ? "" : result.error;
    };
    expect(error({ [`respondentCount-${id}`]: "" })).toContain("응답자 수");
    expect(error({ [`targetCount-${id}`]: "0" })).toContain("대상 인원");
    expect(error({ [`respondentCount-${id}`]: "301" })).toContain("대상 인원보다 클 수 없습니다");
    expect(error({ [`surveyStart-${id}`]: "" })).toContain("조사 기간");
    expect(error({ [`surveyStart-${id}`]: "2026-02-30" })).toContain("조사 기간");
    expect(error({ [`surveyEnd-${id}`]: "2026-11-30" })).toContain("앞설 수 없습니다");
    expect(error({ [`aggregation-${id}`]: "" })).toContain("집계 방식");
    expect(error({ [`aggregation-${id}`]: "mode" })).toContain("집계 방식");
    expect(error({ [`question-${id}`]: "가".repeat(501) })).toContain("500자");
  });
});

describe("월 입력 저장", () => {
  it("처음 저장하면 입력자와 함께 저장되고 이력이 남는다", async () => {
    const result = await saveMonthlyInputs(
      db,
      {
        yearMonth: "2026-11",
        rows: [{ serviceId: ids[0], callCount: 1000, source: "회신 메일" }],
        security: { incident: false, source: null },
      },
      actor,
    );
    expect(result.changes).toBe(2); // call_count, source

    const [row] = await db.select().from(monthlyInputs).where(eq(monthlyInputs.serviceId, ids[0]));
    expect(row).toMatchObject({ callCount: 1000, evidenceGrade: "실측", enteredById: 1, enteredByName: "김관리" });

    // 사고가 없고 기록도 없으면 보안사고 줄을 만들지 않는다.
    expect(await db.select().from(monthlySecurity)).toHaveLength(0);
  });

  it("값을 고치면 이전 값이 변경 이력에 남고, 같은 값을 다시 저장하면 이력이 늘지 않는다", async () => {
    const before = (await db.select().from(changeLogs)).length;

    const edit = await saveMonthlyInputs(
      db,
      {
        yearMonth: "2026-11",
        rows: [{ serviceId: ids[0], callCount: 1500, source: "회신 메일" }],
        security: { incident: false, source: null },
      },
      { id: 2, name: "박담당" },
    );
    expect(edit.changes).toBe(1);

    const logs = await db.select().from(changeLogs);
    const last = logs[logs.length - 1];
    expect(logs.length).toBe(before + 1);
    expect(last).toMatchObject({ fieldName: "call_count", oldValue: "1000", newValue: "1500", changedByName: "박담당" });

    const [row] = await db.select().from(monthlyInputs).where(eq(monthlyInputs.serviceId, ids[0]));
    expect(row.enteredByName).toBe("박담당");

    const same = await saveMonthlyInputs(
      db,
      {
        yearMonth: "2026-11",
        rows: [{ serviceId: ids[0], callCount: 1500, source: "회신 메일" }],
        security: { incident: false, source: null },
      },
      actor,
    );
    expect(same.changes).toBe(0);
    expect((await db.select().from(changeLogs)).length).toBe(before + 1);
  });

  it("보안사고를 저장하고, 해제하면 이력이 남는다", async () => {
    await saveMonthlyInputs(
      db,
      { yearMonth: "2026-10", rows: [], security: { incident: true, source: "보고서" } },
      actor,
    );
    let [security] = await db.select().from(monthlySecurity).where(eq(monthlySecurity.yearMonth, "2026-10"));
    expect(security.incident).toBe(true);

    const cleared = await saveMonthlyInputs(
      db,
      { yearMonth: "2026-10", rows: [], security: { incident: false, source: "보고서" } },
      actor,
    );
    expect(cleared.changes).toBe(1);
    [security] = await db.select().from(monthlySecurity).where(eq(monthlySecurity.yearMonth, "2026-10"));
    expect(security.incident).toBe(false);
  });

  it("저장한 값을 화면용으로 다시 읽을 수 있다", async () => {
    const view = await loadMonthlyForm(db, "2026-11");
    expect(view.rows).toHaveLength(6);
    expect(view.rows[0]).toMatchObject({ callCount: 1500, enteredByName: "박담당" });
    expect(view.rows[1].callCount).toBeNull();
  });
});

describe("설문 설정값 저장", () => {
  const data = {
    year: 2026,
    half: "H2" as const,
    rows: [
      {
        serviceId: 0,
        savedMinutes: 5,
        contributionPct: 90,
        correctionFactor: 1,
        respondentCount: 120,
        targetCount: 300,
        surveyStart: "2026-12-01",
        surveyEnd: "2026-12-12",
        aggregation: "median" as const,
        questionText: null,
        source: "12월 설문",
      },
    ],
  };

  it("반기별로 저장하고, 고치면 덮어쓰되 이전 값이 이력에 남는다", async () => {
    data.rows[0].serviceId = ids[0];
    const first = await saveSurveySettings(db, data, actor);
    // 점수 값 3 + 설문 정보 5(응답자 수, 대상 인원, 시작일, 종료일, 집계 방식) + 출처 1 (설문 문항은 비어 있어 제외)
    expect(first.changes).toBe(9);

    const second = await saveSurveySettings(
      db,
      { ...data, rows: [{ ...data.rows[0], savedMinutes: 8 }] },
      actor,
    );
    expect(second.changes).toBe(1);

    const rows = await db.select().from(surveySettings).where(eq(surveySettings.half, "H2"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ savedMinutes: 8, evidenceGrade: "설문 추정" });

    const logs = await db.select().from(changeLogs).where(eq(changeLogs.fieldName, "saved_minutes"));
    expect(logs.map((log) => [log.oldValue, log.newValue])).toContainEqual(["5", "8"]);
  });

  it("다른 반기의 값은 따로 저장된다", async () => {
    await saveSurveySettings(db, { ...data, half: "H1", rows: [{ ...data.rows[0], savedMinutes: 3 }] }, actor);
    const h1 = await loadSettingsForm(db, 2026, "H1");
    const h2 = await loadSettingsForm(db, 2026, "H2");
    expect(h1[0].savedMinutes).toBe(3);
    expect(h2[0].savedMinutes).toBe(8);
    expect(h2[0]).toMatchObject({ respondentCount: 120, targetCount: 300, aggregation: "median", surveyStart: "2026-12-01" });
    expect(h2[1].savedMinutes).toBeNull();
  });
});
