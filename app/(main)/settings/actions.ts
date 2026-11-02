"use server";

// Design Ref: §7 서버 기능 — 설문 설정값 저장 (관리자만). 해당 반기 값을 덮어쓰고 이전 값은 이력에 남긴다.
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { services } from "@/lib/db/schema";
import type { FormState } from "@/lib/form-state";
import { saveSurveySettings } from "@/lib/inputs";
import { parseSettingsForm } from "@/lib/validation/inputs";

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  try {
    const db = getDb();
    const serviceRows = await db.select({ id: services.id }).from(services);
    const parsed = parseSettingsForm(formData, serviceRows.map((row) => row.id));
    if (!parsed.ok) return { ok: false, message: parsed.error };

    const { changes } = await saveSurveySettings(db, parsed.data, { id: admin.id, name: admin.name });
    return {
      ok: true,
      message:
        changes === 0
          ? "바뀐 값이 없습니다."
          : `저장했습니다. (변경 ${changes}건) 선택한 반기의 모든 달 지수가 새 값으로 다시 계산됩니다.`,
    };
  } catch (error) {
    console.error("설정값 저장 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: "저장하지 못했습니다. 다시 시도하세요." };
  }
}
