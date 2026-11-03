// Design Ref: §5.1 입력값 검사 (Zod): 숫자 범위, 한국어 오류 메시지 (§8 오류 처리)
import { z } from "zod";

import type { Half } from "../score";
import type { Aggregation } from "../survey";

export const YEAR_MONTH_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MonthlyFormData = {
  yearMonth: string;
  rows: { serviceId: number; callCount: number; source: string | null }[];
  security: { incident: boolean; source: string | null };
};

export type SettingsRow = {
  serviceId: number;
  savedMinutes: number;
  contributionPct: number;
  correctionFactor: number;
  respondentCount: number;
  targetCount: number;
  surveyStart: string;
  surveyEnd: string;
  aggregation: Aggregation;
  questionText: string | null;
  source: string | null;
};

export type SettingsFormData = {
  year: number;
  half: Half;
  rows: SettingsRow[];
};

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: string): string | null {
  return value === "" ? null : value;
}

const yearMonthSchema = z.string().regex(YEAR_MONTH_PATTERN, "월 형식이 맞지 않습니다. 예: 2026-11");
const callCountSchema = z
  .string()
  .regex(/^\d+$/, "호출횟수는 0 이상의 정수로 입력하세요.")
  .transform(Number)
  .pipe(z.number().int().max(Number.MAX_SAFE_INTEGER, "호출횟수가 너무 큽니다."));

// 호출횟수 칸이 빈 서비스는 저장하지 않고 건너뛴다. (그 달 데이터는 "데이터 없음"으로 남는다)
export function parseMonthlyForm(formData: FormData, serviceIds: number[]): ParseResult<MonthlyFormData> {
  const yearMonth = yearMonthSchema.safeParse(field(formData, "yearMonth"));
  if (!yearMonth.success) return { ok: false, error: yearMonth.error.issues[0].message };

  const rows: MonthlyFormData["rows"] = [];
  for (const [index, serviceId] of serviceIds.entries()) {
    const raw = field(formData, `callCount-${serviceId}`);
    if (raw === "") continue;
    const callCount = callCountSchema.safeParse(raw);
    if (!callCount.success) {
      return { ok: false, error: `${index + 1}번째 서비스: ${callCount.error.issues[0].message}` };
    }
    rows.push({
      serviceId,
      callCount: callCount.data,
      source: optionalText(field(formData, `source-${serviceId}`)),
    });
  }

  return {
    ok: true,
    data: {
      yearMonth: yearMonth.data,
      rows,
      security: {
        incident: formData.get("incident") === "on",
        source: optionalText(field(formData, "securitySource")),
      },
    },
  };
}

const yearSchema = z
  .string()
  .regex(/^\d{4}$/, "연도는 4자리 숫자로 입력하세요.")
  .transform(Number)
  .pipe(z.number().int().min(2000, "연도는 2000~2099 사이여야 합니다.").max(2099, "연도는 2000~2099 사이여야 합니다."));

const halfSchema = z.enum(["H1", "H2"], { error: "반기를 선택하세요." });
const aggregationSchema = z.enum(["mean", "median", "trimmed_mean"], { error: "집계 방식을 선택하세요." });

function numberField(raw: string, label: string, rule: (n: number) => boolean, ruleText: string) {
  const value = Number(raw);
  if (raw === "" || !Number.isFinite(value) || !rule(value)) {
    return { ok: false as const, error: `${label}은(는) ${ruleText}` };
  }
  return { ok: true as const, value };
}

function isRealDate(raw: string): boolean {
  if (!DATE_PATTERN.test(raw)) return false;
  const date = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw;
}

// 설정값(업무절감시간·업무기여도)이나 설문 정보를 하나라도 채운 서비스는 모두 채워야 한다.
// 전부 빈 서비스는 건너뛴다. 보정계수가 비어 있으면 1(효과 없음)로 저장한다. 설문 문항 원문은 비워도 된다.
export function parseSettingsForm(formData: FormData, serviceIds: number[]): ParseResult<SettingsFormData> {
  const year = yearSchema.safeParse(field(formData, "year"));
  if (!year.success) return { ok: false, error: year.error.issues[0].message };
  const half = halfSchema.safeParse(field(formData, "half"));
  if (!half.success) return { ok: false, error: half.error.issues[0].message };

  const rows: SettingsRow[] = [];
  for (const [index, serviceId] of serviceIds.entries()) {
    const savedRaw = field(formData, `savedMinutes-${serviceId}`);
    const contributionRaw = field(formData, `contributionPct-${serviceId}`);
    const correctionRaw = field(formData, `correctionFactor-${serviceId}`);
    const respondentRaw = field(formData, `respondentCount-${serviceId}`);
    const targetRaw = field(formData, `targetCount-${serviceId}`);
    const startRaw = field(formData, `surveyStart-${serviceId}`);
    const endRaw = field(formData, `surveyEnd-${serviceId}`);
    const aggregationRaw = field(formData, `aggregation-${serviceId}`);

    const untouched = [savedRaw, contributionRaw, respondentRaw, targetRaw, startRaw, endRaw].every((raw) => raw === "");
    if (untouched) continue;

    const prefix = `${index + 1}번째 서비스: `;
    const fail = (error: string): ParseResult<SettingsFormData> => ({ ok: false, error: prefix + error });

    const saved = numberField(savedRaw, "업무절감시간", (n) => n >= 0 && n <= 100000, "0 이상의 숫자로 입력하세요.");
    if (!saved.ok) return fail(saved.error);
    const contribution = numberField(contributionRaw, "업무기여도", (n) => n >= 0 && n <= 100, "0~100 사이의 숫자로 입력하세요.");
    if (!contribution.ok) return fail(contribution.error);
    const correction =
      correctionRaw === ""
        ? { ok: true as const, value: 1 }
        : numberField(correctionRaw, "보정계수", (n) => n > 0 && n <= 9999, "0보다 큰 숫자로 입력하세요.");
    if (!correction.ok) return fail(correction.error);

    const respondent = numberField(respondentRaw, "응답자 수", (n) => Number.isInteger(n) && n >= 1, "1 이상의 정수로 입력하세요.");
    if (!respondent.ok) return fail(respondent.error);
    const target = numberField(targetRaw, "대상 인원", (n) => Number.isInteger(n) && n >= 1, "1 이상의 정수로 입력하세요.");
    if (!target.ok) return fail(target.error);
    if (respondent.value > target.value) return fail("응답자 수는 대상 인원보다 클 수 없습니다.");

    if (!isRealDate(startRaw) || !isRealDate(endRaw)) return fail("조사 기간(시작일·종료일)을 날짜로 입력하세요.");
    if (endRaw < startRaw) return fail("조사 종료일은 시작일보다 앞설 수 없습니다.");

    const aggregation = aggregationSchema.safeParse(aggregationRaw);
    if (!aggregation.success) return fail(aggregation.error.issues[0].message);

    const questionText = optionalText(field(formData, `question-${serviceId}`));
    if (questionText !== null && questionText.length > 500) return fail("설문 문항은 500자 이하로 입력하세요.");

    rows.push({
      serviceId,
      savedMinutes: saved.value,
      contributionPct: contribution.value,
      correctionFactor: correction.value,
      respondentCount: respondent.value,
      targetCount: target.value,
      surveyStart: startRaw,
      surveyEnd: endRaw,
      aggregation: aggregation.data,
      questionText,
      source: optionalText(field(formData, `settingSource-${serviceId}`)),
    });
  }

  return { ok: true, data: { year: year.data, half: half.data, rows } };
}
