"use server";

// Design Ref: §7 서버 기능 — 월 입력 저장, 보안사고 저장 (관리자만)
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { services } from "@/lib/db/schema";
import type { FormState } from "@/lib/form-state";
import { saveMonthlyInputs } from "@/lib/inputs";
import { parseMonthlyForm } from "@/lib/validation/inputs";

export async function saveMonthlyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // 화면에서 숨겨도 안전하지 않다. 저장할 때마다 서버에서 관리자인지 다시 확인한다.
  const admin = await requireAdmin();

  try {
    const db = getDb();
    const serviceRows = await db.select({ id: services.id }).from(services);
    const parsed = parseMonthlyForm(formData, serviceRows.map((row) => row.id));
    if (!parsed.ok) return { ok: false, message: parsed.error };

    const { changes } = await saveMonthlyInputs(db, parsed.data, { id: admin.id, name: admin.name });
    return {
      ok: true,
      message: changes === 0 ? "바뀐 값이 없습니다." : `저장했습니다. (변경 ${changes}건, 변경 이력에 기록됨)`,
    };
  } catch (error) {
    console.error("월 입력 저장 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: "저장하지 못했습니다. 다시 시도하세요." };
  }
}
