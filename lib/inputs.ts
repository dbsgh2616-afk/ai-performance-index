// Design Ref: §5.1 입력 → 검사 → 저장 + 변경 이력, §7 서버 기능
// Plan SC: FR-07 입력자·일시·출처 기록, FR-08 이전 값 보존
// 저장과 변경 이력 기록은 한 트랜잭션에서 처리한다. (중간에 실패하면 둘 다 취소된다)
import { and, asc, eq } from "drizzle-orm";

import { recordChanges } from "./changelog";
import { monthlyInputs, monthlySecurity, services, surveySettings } from "./db/schema";
import type { AppDb } from "./db/types";
import type { Half } from "./score";
import type { Aggregation } from "./survey";
import type { MonthlyFormData, SettingsFormData } from "./validation/inputs";

export type Actor = { id: number; name: string };

export async function saveMonthlyInputs(
  db: AppDb,
  data: MonthlyFormData,
  actor: Actor,
): Promise<{ changes: number }> {
  return db.transaction(async (tx) => {
    let changes = 0;

    for (const row of data.rows) {
      const targetId = `${row.serviceId}:${data.yearMonth}`;
      const [existing] = await tx
        .select()
        .from(monthlyInputs)
        .where(and(eq(monthlyInputs.serviceId, row.serviceId), eq(monthlyInputs.yearMonth, data.yearMonth)))
        .for("update");

      if (!existing) {
        await tx.insert(monthlyInputs).values({
          serviceId: row.serviceId,
          yearMonth: data.yearMonth,
          callCount: row.callCount,
          source: row.source,
          enteredById: actor.id,
          enteredByName: actor.name,
        });
        changes += await recordChanges(tx, {
          targetType: "monthly_input",
          targetId,
          changedByName: actor.name,
          before: null,
          after: { call_count: row.callCount, source: row.source },
        });
        continue;
      }

      const before = { call_count: existing.callCount, source: existing.source };
      const after = { call_count: row.callCount, source: row.source };
      if (before.call_count === after.call_count && before.source === after.source) continue;

      await tx
        .update(monthlyInputs)
        .set({ callCount: row.callCount, source: row.source, enteredById: actor.id, enteredByName: actor.name })
        .where(eq(monthlyInputs.id, existing.id));
      changes += await recordChanges(tx, {
        targetType: "monthly_input",
        targetId,
        changedByName: actor.name,
        before,
        after,
      });
    }

    // 보안사고: 기록이 없는 달은 "사고 없음"으로 보므로, 사고가 없고 기록도 없으면 저장하지 않는다.
    const [existingSecurity] = await tx
      .select()
      .from(monthlySecurity)
      .where(eq(monthlySecurity.yearMonth, data.yearMonth))
      .for("update");
    const securityAfter = { incident: data.security.incident, source: data.security.source };

    if (!existingSecurity) {
      if (securityAfter.incident || securityAfter.source) {
        await tx.insert(monthlySecurity).values({
          yearMonth: data.yearMonth,
          incident: securityAfter.incident,
          source: securityAfter.source,
          enteredById: actor.id,
          enteredByName: actor.name,
        });
        changes += await recordChanges(tx, {
          targetType: "monthly_security",
          targetId: data.yearMonth,
          changedByName: actor.name,
          before: null,
          after: securityAfter,
        });
      }
    } else {
      const securityBefore = { incident: existingSecurity.incident, source: existingSecurity.source };
      if (securityBefore.incident !== securityAfter.incident || securityBefore.source !== securityAfter.source) {
        await tx
          .update(monthlySecurity)
          .set({ ...securityAfter, enteredById: actor.id, enteredByName: actor.name })
          .where(eq(monthlySecurity.yearMonth, data.yearMonth));
        changes += await recordChanges(tx, {
          targetType: "monthly_security",
          targetId: data.yearMonth,
          changedByName: actor.name,
          before: securityBefore,
          after: securityAfter,
        });
      }
    }

    return { changes };
  });
}

export async function saveSurveySettings(
  db: AppDb,
  data: SettingsFormData,
  actor: Actor,
): Promise<{ changes: number }> {
  return db.transaction(async (tx) => {
    let changes = 0;

    for (const row of data.rows) {
      const targetId = `${row.serviceId}:${data.year}-${data.half}`;
      const [existing] = await tx
        .select()
        .from(surveySettings)
        .where(
          and(
            eq(surveySettings.serviceId, row.serviceId),
            eq(surveySettings.year, data.year),
            eq(surveySettings.half, data.half),
          ),
        )
        .for("update");

      const after = {
        saved_minutes: row.savedMinutes,
        contribution_pct: row.contributionPct,
        correction_factor: row.correctionFactor,
        respondent_count: row.respondentCount,
        target_count: row.targetCount,
        survey_start: row.surveyStart,
        survey_end: row.surveyEnd,
        aggregation: row.aggregation,
        question_text: row.questionText,
        source: row.source,
      };

      if (!existing) {
        await tx.insert(surveySettings).values({
          serviceId: row.serviceId,
          year: data.year,
          half: data.half,
          savedMinutes: row.savedMinutes,
          contributionPct: row.contributionPct,
          correctionFactor: row.correctionFactor,
          respondentCount: row.respondentCount,
          targetCount: row.targetCount,
          surveyStart: row.surveyStart,
          surveyEnd: row.surveyEnd,
          aggregation: row.aggregation,
          questionText: row.questionText,
          source: row.source,
          enteredById: actor.id,
          enteredByName: actor.name,
        });
        changes += await recordChanges(tx, {
          targetType: "survey_setting",
          targetId,
          changedByName: actor.name,
          before: null,
          after,
        });
        continue;
      }

      const before = {
        saved_minutes: existing.savedMinutes,
        contribution_pct: existing.contributionPct,
        correction_factor: existing.correctionFactor,
        respondent_count: existing.respondentCount,
        target_count: existing.targetCount,
        survey_start: existing.surveyStart,
        survey_end: existing.surveyEnd,
        aggregation: existing.aggregation,
        question_text: existing.questionText,
        source: existing.source,
      };
      const unchanged = (Object.keys(after) as (keyof typeof after)[]).every((key) => before[key] === after[key]);
      if (unchanged) continue;

      await tx
        .update(surveySettings)
        .set({
          savedMinutes: row.savedMinutes,
          contributionPct: row.contributionPct,
          correctionFactor: row.correctionFactor,
          respondentCount: row.respondentCount,
          targetCount: row.targetCount,
          surveyStart: row.surveyStart,
          surveyEnd: row.surveyEnd,
          aggregation: row.aggregation,
          questionText: row.questionText,
          source: row.source,
          enteredById: actor.id,
          enteredByName: actor.name,
        })
        .where(eq(surveySettings.id, existing.id));
      changes += await recordChanges(tx, {
        targetType: "survey_setting",
        targetId,
        changedByName: actor.name,
        before,
        after,
      });
    }

    return { changes };
  });
}

export type MonthlyFormRow = {
  serviceId: number;
  serviceName: string;
  callCount: number | null;
  source: string | null;
  enteredByName: string | null;
  enteredAt: Date | null;
};

export type MonthlyFormView = {
  rows: MonthlyFormRow[];
  security: { incident: boolean; source: string | null } | null;
};

export async function loadMonthlyForm(db: AppDb, yearMonth: string): Promise<MonthlyFormView> {
  const [serviceRows, inputRows, securityRows] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(monthlyInputs).where(eq(monthlyInputs.yearMonth, yearMonth)),
    db.select().from(monthlySecurity).where(eq(monthlySecurity.yearMonth, yearMonth)),
  ]);

  return {
    rows: serviceRows.map((service) => {
      const input = inputRows.find((row) => row.serviceId === service.id);
      return {
        serviceId: service.id,
        serviceName: service.name,
        callCount: input?.callCount ?? null,
        source: input?.source ?? null,
        enteredByName: input?.enteredByName ?? null,
        enteredAt: input?.enteredAt ?? null,
      };
    }),
    security: securityRows[0] ? { incident: securityRows[0].incident, source: securityRows[0].source } : null,
  };
}

export type SettingsFormRow = {
  serviceId: number;
  serviceName: string;
  savedMinutes: number | null;
  contributionPct: number | null;
  correctionFactor: number | null;
  respondentCount: number | null;
  targetCount: number | null;
  surveyStart: string | null;
  surveyEnd: string | null;
  aggregation: Aggregation | null;
  questionText: string | null;
  source: string | null;
  enteredByName: string | null;
  enteredAt: Date | null;
};

export async function loadSettingsForm(db: AppDb, year: number, half: Half): Promise<SettingsFormRow[]> {
  const [serviceRows, settingRows] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db
      .select()
      .from(surveySettings)
      .where(and(eq(surveySettings.year, year), eq(surveySettings.half, half))),
  ]);

  return serviceRows.map((service) => {
    const setting = settingRows.find((row) => row.serviceId === service.id);
    return {
      serviceId: service.id,
      serviceName: service.name,
      savedMinutes: setting?.savedMinutes ?? null,
      contributionPct: setting?.contributionPct ?? null,
      correctionFactor: setting?.correctionFactor ?? null,
      respondentCount: setting?.respondentCount ?? null,
      targetCount: setting?.targetCount ?? null,
      surveyStart: setting?.surveyStart ?? null,
      surveyEnd: setting?.surveyEnd ?? null,
      aggregation: setting?.aggregation ?? null,
      questionText: setting?.questionText ?? null,
      source: setting?.source ?? null,
      enteredByName: setting?.enteredByName ?? null,
      enteredAt: setting?.enteredAt ?? null,
    };
  });
}
