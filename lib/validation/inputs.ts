// Design Ref: §5.1 입력값 검사 (Zod): 숫자 범위, 한국어 오류 메시지 (§8 오류 처리)
import { z } from "zod";

import type { Half } from "../score";

export const YEAR_MONTH_PATTERN = /^20\d{2}-(0[1-9]|1[0-2])$/;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type MonthlyFormData = {
  yearMonth: string;
  rows: { serviceId: number; callCount: number; source: string | null }[];
  security: { incident: boolean; source: string | null };
};

export type SettingsFormData = {
  year: number;
  half: Half;
  rows: {
    serviceId: number;
    savedMinutes: number;
    contributionPct: number;
    correctionFactor: number;
    source: string | null;
  }[];
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

function numberField(raw: string, label: string, rule: (n: number) => boolean, ruleText: string) {
  const value = Number(raw);
  if (raw === "" || !Number.isFinite(value) || !rule(value)) {
    return { ok: false as const, error: `${label}은(는) ${ruleText}` };
  }
  return { ok: true as const, value };
}

// 업무절감시간과 업무기여도가 모두 빈 서비스는 건너뛴다. 하나만 채우면 오류다.
// 보정계수가 비어 있으면 1(효과 없음)로 저장한다.
export function parseSettingsForm(formData: FormData, serviceIds: number[]): ParseResult<SettingsFormData> {
  const year = yearSchema.safeParse(field(formData, "year"));
  if (!year.success) return { ok: false, error: year.error.issues[0].message };
  const half = halfSchema.safeParse(field(formData, "half"));
  if (!half.success) return { ok: false, error: half.error.issues[0].message };

  const rows: SettingsFormData["rows"] = [];
  for (const [index, serviceId] of serviceIds.entries()) {
    const savedRaw = field(formData, `savedMinutes-${serviceId}`);
    const contributionRaw = field(formData, `contributionPct-${serviceId}`);
    const correctionRaw = field(formData, `correctionFactor-${serviceId}`);
    if (savedRaw === "" && contributionRaw === "") continue;

    const prefix = `${index + 1}번째 서비스: `;
    const saved = numberField(savedRaw, "업무절감시간", (n) => n >= 0 && n <= 100000, "0 이상의 숫자로 입력하세요.");
    if (!saved.ok) return { ok: false, error: prefix + saved.error };
    const contribution = numberField(contributionRaw, "업무기여도", (n) => n >= 0 && n <= 100, "0~100 사이의 숫자로 입력하세요.");
    if (!contribution.ok) return { ok: false, error: prefix + contribution.error };
    const correction = correctionRaw === ""
      ? { ok: true as const, value: 1 }
      : numberField(correctionRaw, "보정계수", (n) => n > 0 && n <= 9999, "0보다 큰 숫자로 입력하세요.");
    if (!correction.ok) return { ok: false, error: prefix + correction.error };

    rows.push({
      serviceId,
      savedMinutes: saved.value,
      contributionPct: contribution.value,
      correctionFactor: correction.value,
      source: optionalText(field(formData, `settingSource-${serviceId}`)),
    });
  }

  return { ok: true, data: { year: year.data, half: half.data, rows } };
}
