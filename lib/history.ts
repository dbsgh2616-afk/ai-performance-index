// Design Ref: §4.7 변경 이력 (`/history`) — 기간·대상 필터로 모든 수정의 이전 값·새 값을 보여준다.
import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import { changeLogs, services } from "./db/schema";
import type { AppDb } from "./db/types";
import { formatDateTime } from "./format";
import { fieldLabel, targetLabel } from "./evidence/labels";

export type HistoryTarget = (typeof changeLogs.$inferSelect)["targetType"];
export const HISTORY_TARGETS: HistoryTarget[] = ["monthly_input", "monthly_security", "survey_setting", "account"];

export type HistoryFilter = {
  from?: string; // YYYY-MM-DD (한국 시간)
  to?: string; // YYYY-MM-DD (그날 끝까지)
  target?: HistoryTarget;
  limit?: number;
};

export type HistoryRow = {
  id: number;
  changedAt: string;
  changedByName: string;
  target: string;
  object: string;
  field: string;
  oldValue: string;
  newValue: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ROLE_LABELS: Record<string, string> = { admin: "관리자", viewer: "조회자" };
const AGGREGATION_LABELS: Record<string, string> = { mean: "평균", median: "중앙값", trimmed_mean: "절사평균" };

function startOfDayKst(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

export function isDateString(value: string | undefined): value is string {
  return !!value && DATE_PATTERN.test(value) && !Number.isNaN(startOfDayKst(value).getTime());
}

export async function loadHistory(db: AppDb, filter: HistoryFilter = {}): Promise<HistoryRow[]> {
  const conditions = [];
  if (isDateString(filter.from)) conditions.push(gte(changeLogs.changedAt, startOfDayKst(filter.from)));
  if (isDateString(filter.to)) {
    const next = startOfDayKst(filter.to);
    next.setDate(next.getDate() + 1);
    conditions.push(lt(changeLogs.changedAt, next));
  }
  if (filter.target) conditions.push(eq(changeLogs.targetType, filter.target));

  const [rows, serviceRows] = await Promise.all([
    db
      .select()
      .from(changeLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(changeLogs.changedAt), desc(changeLogs.id))
      .limit(filter.limit ?? 200),
    db.select().from(services).orderBy(asc(services.sortOrder)),
  ]);

  const nameOf = new Map(serviceRows.map((row) => [String(row.id), row.name]));

  return rows.map((row) => {
    // 대상 번호: 월 입력 "서비스번호:월", 보안사고 "월", 설정값 "서비스번호:연도-반기", 계정 "아이디"
    let object = row.targetId;
    if (row.targetType === "monthly_input" || row.targetType === "survey_setting") {
      const [serviceId, period] = row.targetId.split(":");
      object = `${nameOf.get(serviceId) ?? `서비스 ${serviceId}`} ${period ?? ""}`.trim();
    }

    const display = (value: string | null) => {
      if (value === null) return "-";
      if (row.fieldName === "role") return ROLE_LABELS[value] ?? value;
      if (row.fieldName === "aggregation") return AGGREGATION_LABELS[value] ?? value;
      return value;
    };

    return {
      id: row.id,
      changedAt: formatDateTime(row.changedAt),
      changedByName: row.changedByName,
      target: targetLabel(row.targetType),
      object,
      field: fieldLabel(row.fieldName),
      oldValue: display(row.oldValue),
      newValue: display(row.newValue),
    };
  });
}
