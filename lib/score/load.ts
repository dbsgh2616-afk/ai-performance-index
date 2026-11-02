// DB에서 한 해의 계산 재료를 읽어 lib/score가 쓰는 모양으로 바꾼다.
// 지수는 항상 현재 저장된 값으로 계산한다. (PRD 5번: 값이 늦게 들어오거나 바뀌면 과거 달도 다시 계산된다)
import { and, asc, eq, like } from "drizzle-orm";

import { monthlyInputs, monthlySecurity, services, surveySettings } from "../db/schema";
import type { AppDb } from "../db/types";
import type { ScoreData } from "./index";

export async function loadScoreData(db: AppDb, year: number): Promise<ScoreData> {
  const [serviceRows, inputRows, settingRows, securityRows] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(monthlyInputs).where(like(monthlyInputs.yearMonth, `${year}-%`)),
    db.select().from(surveySettings).where(eq(surveySettings.year, year)),
    db
      .select()
      .from(monthlySecurity)
      .where(and(like(monthlySecurity.yearMonth, `${year}-%`), eq(monthlySecurity.incident, true))),
  ]);

  return {
    year,
    services: serviceRows.map((row) => ({ id: row.id, name: row.name })),
    inputs: inputRows.map((row) => ({
      serviceId: row.serviceId,
      yearMonth: row.yearMonth,
      callCount: row.callCount,
      evidenceGrade: row.evidenceGrade,
    })),
    settings: settingRows.map((row) => ({
      serviceId: row.serviceId,
      year: row.year,
      half: row.half,
      savedMinutes: row.savedMinutes,
      contributionPct: row.contributionPct,
      correctionFactor: row.correctionFactor,
      evidenceGrade: row.evidenceGrade,
      survey: {
        respondentCount: row.respondentCount,
        targetCount: row.targetCount,
        surveyStart: row.surveyStart,
        surveyEnd: row.surveyEnd,
        aggregation: row.aggregation,
        questionText: row.questionText,
        source: row.source,
      },
    })),
    securityIncidentMonths: securityRows.map((row) => row.yearMonth),
  };
}
