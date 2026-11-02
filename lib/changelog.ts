// Design Ref: §5.1 입력 → 저장 → 변경 이력 기록, §6.2 change_logs
// Plan SC: 4 산출 근거 기록 — 값을 고쳐도 이전 값을 지우지 않고 이력으로 남긴다.
import { changeLogs } from "./db/schema";
import type { Executor } from "./db/types";

export type ChangeTarget = (typeof changeLogs.$inferInsert)["targetType"];

type Snapshot = Record<string, unknown>;

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// 이전 값(before)과 새 값(after)을 비교해 바뀐 항목마다 이력 한 줄을 남긴다.
// 새로 만든 경우(before가 null)에는 새 값이 있는 항목을 모두 남긴다.
// 반드시 값을 저장하는 트랜잭션 안에서 부른다. (저장과 이력이 함께 성공하거나 함께 취소된다.)
export async function recordChanges(
  tx: Executor,
  params: {
    targetType: ChangeTarget;
    targetId: string;
    changedByName: string;
    before: Snapshot | null;
    after: Snapshot;
  },
): Promise<number> {
  const rows = Object.keys(params.after).flatMap((field) => {
    const oldValue = formatValue(params.before?.[field]);
    const newValue = formatValue(params.after[field]);
    if (oldValue === newValue) return [];
    return [
      {
        targetType: params.targetType,
        targetId: params.targetId,
        fieldName: field,
        oldValue,
        newValue,
        changedByName: params.changedByName,
      },
    ];
  });

  if (rows.length > 0) {
    await tx.insert(changeLogs).values(rows);
  }
  return rows.length;
}
