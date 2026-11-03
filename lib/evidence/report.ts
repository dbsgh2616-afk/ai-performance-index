// Design Ref: §4.8 증적자료 — 서비스×월 지수 표, 연간 누적, 수치별 근거 등급·출처·입력자·입력 일시,
// 반기별 설정값과 출처, 보안사고 감점 여부, 선택한 연도의 변경 이력. 출력 일시·출력자를 표시한다.
// Plan SC: FR-10 증적자료 출력, FR-11 출처 없는 값은 "근거 미확인"
// PDF와 엑셀이 같은 자료(EvidenceReport)를 쓰므로 두 파일의 숫자가 다를 수 없다.
import { asc, desc, eq, like, ne } from "drizzle-orm";

import { changeLogs, monthlyInputs, monthlySecurity, services, surveySettings } from "../db/schema";
import type { AppDb } from "../db/types";
import { formatDateTime } from "../format";
import { calculateYear, type YearScore } from "../score";
import { loadScoreData } from "../score/load";
import {
  aggregationLabel,
  formatRespondents,
  formatResponseRate,
  formatSurveyPeriod,
  NOT_RECORDED,
} from "../survey";
import { fieldLabel, targetLabel, UNVERIFIED } from "./labels";

export type EvidenceInputRow = {
  serviceName: string;
  yearMonth: string;
  callCount: number;
  grade: string;
  source: string; // 없으면 "근거 미확인"
  enteredByName: string;
  enteredAt: string;
};

export type EvidenceSettingRow = {
  serviceName: string;
  period: string; // 예: 2026 상반기(1~6월)
  savedMinutes: number;
  contributionPct: number;
  correctionFactor: number;
  grade: string;
  respondents: string; // 예: 188명 / 420명
  responseRate: string; // 예: 44.8%
  surveyPeriod: string; // 예: 2026-06-01 ~ 2026-06-12
  aggregation: string; // 평균 / 중앙값 / 절사평균
  question: string; // 설문 문항 원문
  source: string;
  enteredByName: string;
  enteredAt: string;
};

export type EvidenceSecurityRow = {
  yearMonth: string;
  incident: boolean;
  penalty: string; // "50% 감점 적용" / "감점 없음"
  source: string;
  enteredByName: string;
  enteredAt: string;
};

export type EvidenceChangeRow = {
  changedAt: string;
  changedByName: string;
  target: string;
  field: string;
  oldValue: string;
  newValue: string;
};

export type EvidenceReport = {
  year: number;
  printedAt: string;
  printedBy: string;
  yearScore: YearScore;
  inputs: EvidenceInputRow[];
  settings: EvidenceSettingRow[];
  securityRecords: EvidenceSecurityRow[];
  changes: EvidenceChangeRow[];
  unverifiedCount: number;
};

const orUnverified = (source: string | null): string => (source && source.trim() ? source : UNVERIFIED);

export async function buildEvidenceReport(
  db: AppDb,
  year: number,
  printedBy: string,
  printedAt: Date = new Date(),
): Promise<EvidenceReport> {
  const data = await loadScoreData(db, year);
  const yearScore = calculateYear(data);
  const prefix = `${year}-%`;

  const [serviceRows, inputRows, settingRows, securityRows, logRows] = await Promise.all([
    db.select().from(services).orderBy(asc(services.sortOrder)),
    db.select().from(monthlyInputs).where(like(monthlyInputs.yearMonth, prefix)),
    db.select().from(surveySettings).where(eq(surveySettings.year, year)),
    db.select().from(monthlySecurity).where(like(monthlySecurity.yearMonth, prefix)),
    db.select().from(changeLogs).where(ne(changeLogs.targetType, "account")).orderBy(desc(changeLogs.changedAt), desc(changeLogs.id)),
  ]);

  const nameOf = new Map(serviceRows.map((row) => [row.id, row.name]));
  const orderOf = new Map(serviceRows.map((row) => [row.id, row.sortOrder]));

  const inputs = [...inputRows]
    .sort((a, b) => (orderOf.get(a.serviceId) ?? 0) - (orderOf.get(b.serviceId) ?? 0) || a.yearMonth.localeCompare(b.yearMonth))
    .map<EvidenceInputRow>((row) => ({
      serviceName: nameOf.get(row.serviceId) ?? String(row.serviceId),
      yearMonth: row.yearMonth,
      callCount: row.callCount,
      grade: row.evidenceGrade,
      source: orUnverified(row.source),
      enteredByName: row.enteredByName,
      enteredAt: formatDateTime(row.enteredAt),
    }));

  const settings = [...settingRows]
    .sort((a, b) => (orderOf.get(a.serviceId) ?? 0) - (orderOf.get(b.serviceId) ?? 0) || a.half.localeCompare(b.half))
    .map<EvidenceSettingRow>((row) => ({
      serviceName: nameOf.get(row.serviceId) ?? String(row.serviceId),
      period: row.half === "H1" ? `${row.year} 상반기(1~6월)` : `${row.year} 하반기(7~12월)`,
      savedMinutes: row.savedMinutes,
      contributionPct: row.contributionPct,
      correctionFactor: row.correctionFactor,
      grade: row.evidenceGrade,
      respondents: formatRespondents(row.respondentCount, row.targetCount),
      responseRate: formatResponseRate(row.respondentCount, row.targetCount),
      surveyPeriod: formatSurveyPeriod(row.surveyStart, row.surveyEnd),
      aggregation: aggregationLabel(row.aggregation),
      question: row.questionText ?? NOT_RECORDED,
      source: orUnverified(row.source),
      enteredByName: row.enteredByName,
      enteredAt: formatDateTime(row.enteredAt),
    }));

  const securityRecords = [...securityRows]
    .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth))
    .map<EvidenceSecurityRow>((row) => ({
      yearMonth: row.yearMonth,
      incident: row.incident,
      penalty: row.incident ? "50% 감점 적용" : "감점 없음",
      source: orUnverified(row.source),
      enteredByName: row.enteredByName,
      enteredAt: formatDateTime(row.enteredAt),
    }));

  // 선택한 연도의 변경 이력만 남긴다. (대상 번호에서 연도를 읽는다)
  const changes = logRows
    .filter((row) => {
      if (row.targetType === "monthly_security") return row.targetId.startsWith(`${year}-`);
      const tail = row.targetId.split(":")[1] ?? "";
      return tail.startsWith(`${year}-`);
    })
    .map<EvidenceChangeRow>((row) => {
      const [serviceId, period] = row.targetId.split(":");
      const serviceName = nameOf.get(Number(serviceId));
      return {
        changedAt: formatDateTime(row.changedAt),
        changedByName: row.changedByName,
        target:
          row.targetType === "monthly_security"
            ? `${targetLabel(row.targetType)} ${row.targetId}`
            : `${targetLabel(row.targetType)} ${serviceName ?? serviceId} ${period ?? ""}`.trim(),
        field: fieldLabel(row.fieldName),
        oldValue: row.oldValue ?? "-",
        newValue: row.newValue ?? "-",
      };
    });

  const unverifiedCount = [...inputs, ...settings, ...securityRecords].filter((row) => row.source === UNVERIFIED).length;

  return {
    year,
    printedAt: formatDateTime(printedAt),
    printedBy,
    yearScore,
    inputs,
    settings,
    securityRecords,
    changes,
    unverifiedCount,
  };
}
