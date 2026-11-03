// AI 인프라 계기판 — 월별 지표(GPU·메모리·스토리지 사용률, 가동률)의 입력·저장·읽기.
// 지수 계산에는 쓰지 않는다. 서버에서 자동으로 읽지 않고 관리자가 월 1회 직접 입력한다. (파일럿 단계의 값은 가상일 수 있다)
// 저장과 변경 이력 기록은 한 트랜잭션에서 처리한다.
import { eq } from "drizzle-orm";
import { z } from "zod";

import { recordChanges } from "./changelog";
import { infraMetrics } from "./db/schema";
import type { AppDb } from "./db/types";
import type { Actor } from "./inputs";
import { YEAR_MONTH_PATTERN, type ParseResult } from "./validation/inputs";

export type InfraKey = "gpu" | "memory" | "storage" | "uptime";

export type InfraValues = Record<InfraKey, number>;

export type InfraFormData = { yearMonth: string; values: InfraValues; source: string | null };

// 계기판 한 칸의 정의. kind가 "usage"면 낮을수록 좋고, "uptime"이면 높을수록 좋다.
export const INFRA_GAUGES: { key: InfraKey; label: string; column: string; kind: "usage" | "uptime" }[] = [
  { key: "gpu", label: "GPU 사용률", column: "gpu_usage_pct", kind: "usage" },
  { key: "memory", label: "메모리 사용률", column: "memory_usage_pct", kind: "usage" },
  { key: "storage", label: "스토리지 사용률", column: "storage_usage_pct", kind: "usage" },
  { key: "uptime", label: "서비스 가동률", column: "uptime_pct", kind: "uptime" },
];

export type DialLevel = "ok" | "warn" | "danger";

// 사용률은 70% 미만 정상, 85% 미만 주의, 그 이상 위험. 가동률은 99.5% 이상 정상, 99% 이상 주의, 그 미만 위험.
export function dialLevel(kind: "usage" | "uptime", value: number): DialLevel {
  if (kind === "usage") return value < 70 ? "ok" : value < 85 ? "warn" : "danger";
  return value >= 99.5 ? "ok" : value >= 99 ? "warn" : "danger";
}

const percentSchema = (label: string) =>
  z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, `${label}은(는) 0~100 사이 숫자(소수 둘째 자리까지)로 입력하세요.`)
    .transform(Number)
    .pipe(z.number().min(0, `${label}은(는) 0 이상이어야 합니다.`).max(100, `${label}은(는) 100 이하여야 합니다.`));

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// 4개 값이 모두 비어 있으면 저장할 것이 없다는 뜻으로 null 값을 돌려 준다. 일부만 비어 있으면 오류.
export function parseInfraForm(formData: FormData): ParseResult<InfraFormData | null> {
  const yearMonth = field(formData, "yearMonth");
  if (!YEAR_MONTH_PATTERN.test(yearMonth)) return { ok: false, error: "월 형식이 맞지 않습니다. 예: 2026-11" };

  const raws = INFRA_GAUGES.map((gauge) => ({ gauge, raw: field(formData, gauge.key) }));
  if (raws.every(({ raw }) => raw === "")) return { ok: true, data: null };

  const values = {} as InfraValues;
  for (const { gauge, raw } of raws) {
    if (raw === "") return { ok: false, error: `${gauge.label}을(를) 입력하세요. (4개 값을 모두 입력해야 저장됩니다)` };
    const parsed = percentSchema(gauge.label).safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
    values[gauge.key] = parsed.data;
  }
  const source = field(formData, "source");
  return { ok: true, data: { yearMonth, values, source: source === "" ? null : source } };
}

export async function saveInfraMetrics(db: AppDb, data: InfraFormData, actor: Actor): Promise<{ changes: number }> {
  return db.transaction(async (tx) => {
    const after = {
      gpu_usage_pct: data.values.gpu,
      memory_usage_pct: data.values.memory,
      storage_usage_pct: data.values.storage,
      uptime_pct: data.values.uptime,
      source: data.source,
    };
    const [existing] = await tx.select().from(infraMetrics).where(eq(infraMetrics.yearMonth, data.yearMonth)).for("update");

    const row = {
      gpuUsagePct: data.values.gpu,
      memoryUsagePct: data.values.memory,
      storageUsagePct: data.values.storage,
      uptimePct: data.values.uptime,
      source: data.source,
      enteredById: actor.id,
      enteredByName: actor.name,
    };

    if (!existing) {
      await tx.insert(infraMetrics).values({ yearMonth: data.yearMonth, ...row });
      return {
        changes: await recordChanges(tx, {
          targetType: "infra_metric",
          targetId: data.yearMonth,
          changedByName: actor.name,
          before: null,
          after,
        }),
      };
    }

    const before = {
      gpu_usage_pct: existing.gpuUsagePct,
      memory_usage_pct: existing.memoryUsagePct,
      storage_usage_pct: existing.storageUsagePct,
      uptime_pct: existing.uptimePct,
      source: existing.source,
    };
    const unchanged = (Object.keys(after) as (keyof typeof after)[]).every((key) => before[key] === after[key]);
    if (unchanged) return { changes: 0 };

    await tx.update(infraMetrics).set(row).where(eq(infraMetrics.yearMonth, data.yearMonth));
    return {
      changes: await recordChanges(tx, {
        targetType: "infra_metric",
        targetId: data.yearMonth,
        changedByName: actor.name,
        before,
        after,
      }),
    };
  });
}

export type InfraSnapshot = {
  yearMonth: string;
  values: InfraValues;
  source: string | null;
  enteredByName: string;
  enteredAt: Date;
};

export async function loadInfra(db: AppDb, yearMonth: string): Promise<InfraSnapshot | null> {
  const [row] = await db.select().from(infraMetrics).where(eq(infraMetrics.yearMonth, yearMonth));
  if (!row) return null;
  return {
    yearMonth: row.yearMonth,
    values: { gpu: row.gpuUsagePct, memory: row.memoryUsagePct, storage: row.storageUsagePct, uptime: row.uptimePct },
    source: row.source,
    enteredByName: row.enteredByName,
    enteredAt: row.enteredAt,
  };
}
