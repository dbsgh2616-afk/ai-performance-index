// 추정 ROI — AI 서비스가 아낀 업무 시간을 돈으로 바꾼 효과와, 인프라에 든 비용(도입비를 내용연수로 나눈 월 상각비 + 월 운영비)을 견준다.
//   효과(원)  = Σ 호출횟수 × 건당 업무절감시간(분) × 업무기여도(%) ÷ 60  ×  시간당 인건비 단가
//   비용(원)  = (도입비용 합계 ÷ (내용연수 × 12) + 연간 운영비 ÷ 12) × 비용을 센 개월 수
//   ROI(%)    = (효과 − 비용) ÷ 비용 × 100
// 업무절감시간·업무기여도가 설문 추정값이므로 이 ROI도 "추정"이다. 보정계수는 관리용 조정값이라 효과에 넣지 않는다.
// 화면과 DB를 모르는 계산(computeRoi)과, DB에 입력값을 저장하는 부분이 한 파일에 있다.
import { eq } from "drizzle-orm";
import { z } from "zod";

import { recordChanges } from "./changelog";
import { roiInputs } from "./db/schema";
import type { AppDb } from "./db/types";
import type { Actor } from "./inputs";
import type { ScoreData } from "./score";
import type { ParseResult } from "./validation/inputs";

export type RoiKey =
  | "capex_gpu"
  | "gpu_count"
  | "capex_storage"
  | "capex_network"
  | "capex_license"
  | "capex_build"
  | "opex_year"
  | "life_years"
  | "hourly_rate";

// GPU 수량(gpu_count)은 화면에 보여 주기만 하고 ROI 계산에는 필요하지 않으므로 없어도 된다.
export type RoiValues = Record<Exclude<RoiKey, "gpu_count">, number> & { gpu_count?: number };

export const ROI_FIELDS: { key: RoiKey; label: string; unit: "원" | "년" | "대"; group: "capex" | "opex" | "rate"; optional?: boolean }[] = [
  { key: "gpu_count", label: "GPU 수량", unit: "대", group: "capex", optional: true },
  { key: "capex_gpu", label: "GPU 서버 도입비", unit: "원", group: "capex" },
  { key: "capex_storage", label: "스토리지 도입비", unit: "원", group: "capex" },
  { key: "capex_network", label: "네트워크·보안장비 도입비", unit: "원", group: "capex" },
  { key: "capex_license", label: "소프트웨어·라이선스 도입비", unit: "원", group: "capex" },
  { key: "capex_build", label: "구축·이행 용역비", unit: "원", group: "capex" },
  { key: "opex_year", label: "연간 운영비 (전력·유지보수·운영인건비)", unit: "원", group: "opex" },
  { key: "life_years", label: "내용연수", unit: "년", group: "opex" },
  { key: "hourly_rate", label: "시간당 인건비 단가", unit: "원", group: "rate" },
];

export const ROI_KEYS = ROI_FIELDS.map((field) => field.key);
// ROI를 계산하려면 이 항목들이 모두 있어야 한다.
const REQUIRED_KEYS = ROI_FIELDS.filter((field) => !field.optional).map((field) => field.key);

export function roiLabel(key: string): string {
  return ROI_FIELDS.find((field) => field.key === key)?.label ?? key;
}

// ── 금액 표시 ────────────────────────────────────────────────

// 큰 금액을 읽기 쉽게: 1.2억원, 8,800만원, 9,500원
export function formatWon(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
  if (abs >= 1e4) return `${sign}${Math.round(abs / 1e4).toLocaleString("ko-KR")}만원`;
  return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
}

// ── 계산 ─────────────────────────────────────────────────────

export type RoiResult = {
  months: number; // 비용과 효과를 센 개월 수 (입력이 있는 달)
  hours: number; // 아낀 업무 시간
  benefit: number; // 효과(원)
  cost: number; // 비용(원)
  monthlyCost: number; // 월 비용(원)
  roiPct: number; // 추정 ROI(%)
};

const halfOfMonth = (yearMonth: string) => (Number(yearMonth.slice(5, 7)) <= 6 ? "H1" : "H2");

// 올해 1월부터 focusMonth까지, 호출횟수가 입력된 달을 기준으로 계산한다.
// 입력값이 모자라거나 비용이 0이면 계산하지 못하므로 null(데이터 없음)이다.
export function computeRoi(data: ScoreData, values: Partial<RoiValues> | null, focusMonth: string): RoiResult | null {
  if (!values || REQUIRED_KEYS.some((key) => values[key as keyof RoiValues] === undefined)) return null;
  const v = values as RoiValues;
  if (v.life_years <= 0) return null;

  const capex = v.capex_gpu + v.capex_storage + v.capex_network + v.capex_license + v.capex_build;
  const monthlyCost = capex / (v.life_years * 12) + v.opex_year / 12;
  if (monthlyCost <= 0) return null;

  const counted = data.inputs.filter((input) => input.yearMonth <= focusMonth);
  const months = new Set(counted.map((input) => input.yearMonth)).size;
  if (months === 0) return null;

  let hours = 0;
  for (const input of counted) {
    const setting = data.settings.find((row) => row.serviceId === input.serviceId && row.half === halfOfMonth(input.yearMonth));
    if (!setting) continue;
    hours += (input.callCount * setting.savedMinutes * (setting.contributionPct / 100)) / 60;
  }

  const benefit = hours * v.hourly_rate;
  const cost = monthlyCost * months;
  return { months, hours, benefit, cost, monthlyCost, roiPct: ((benefit - cost) / cost) * 100 };
}

// ── 입력·저장 ────────────────────────────────────────────────

const amountSchema = (label: string, max: number, min = 0) =>
  z
    .string()
    .regex(/^\d{1,16}(\.\d{1,2})?$/, `${label}은(는) 0 이상의 숫자로 입력하세요.`)
    .transform(Number)
    .pipe(z.number().min(min, `${label}은(는) ${min} 이상이어야 합니다.`).max(max, `${label}이(가) 너무 큽니다.`));

// GPU 수량처럼 0 이상의 정수
const countSchema = (label: string) =>
  z
    .string()
    .regex(/^\d{1,6}$/, `${label}은(는) 0 이상의 정수로 입력하세요.`)
    .transform(Number);

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().replace(/,/g, "") : "";
}

// 비어 있는 칸은 건너뛴다. 값이 있는 칸만 검사해 저장한다.
export function parseRoiForm(formData: FormData): ParseResult<Partial<RoiValues>> {
  const values: Partial<RoiValues> = {};
  for (const item of ROI_FIELDS) {
    const raw = field(formData, item.key);
    if (raw === "") continue;
    const schema =
      item.key === "life_years" ? amountSchema(item.label, 50, 1) : item.key === "gpu_count" ? countSchema(item.label) : amountSchema(item.label, 1e13);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    values[item.key] = parsed.data;
  }
  return { ok: true, data: values };
}

export async function saveRoiInputs(db: AppDb, values: Partial<RoiValues>, actor: Actor): Promise<{ changes: number }> {
  return db.transaction(async (tx) => {
    let changes = 0;
    for (const item of ROI_FIELDS) {
      const next = values[item.key];
      if (next === undefined) continue;

      const [existing] = await tx.select().from(roiInputs).where(eq(roiInputs.key, item.key)).for("update");
      if (!existing) {
        await tx.insert(roiInputs).values({ key: item.key, value: next, enteredById: actor.id, enteredByName: actor.name });
        changes += await recordChanges(tx, { targetType: "roi_input", targetId: item.key, changedByName: actor.name, before: null, after: { value: next } });
        continue;
      }
      if (existing.value === next) continue;

      await tx.update(roiInputs).set({ value: next, enteredById: actor.id, enteredByName: actor.name }).where(eq(roiInputs.key, item.key));
      changes += await recordChanges(tx, {
        targetType: "roi_input",
        targetId: item.key,
        changedByName: actor.name,
        before: { value: existing.value },
        after: { value: next },
      });
    }
    return { changes };
  });
}

// 저장된 값 전부. 항목이 하나도 없으면 null.
export async function loadRoiInputs(db: AppDb): Promise<Partial<RoiValues> | null> {
  const rows = await db.select().from(roiInputs);
  if (rows.length === 0) return null;
  const values: Partial<RoiValues> = {};
  for (const row of rows) {
    if ((ROI_KEYS as string[]).includes(row.key)) values[row.key as RoiKey] = row.value;
  }
  return values;
}
