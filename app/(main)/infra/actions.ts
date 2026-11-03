"use server";

// AI 인프라 지표 저장 (관리자만)
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { parseInfraForm, saveInfraMetrics } from "@/lib/infra";
import { parseRoiForm, saveRoiInputs } from "@/lib/roi";

export async function saveRoiAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();

  try {
    const parsed = parseRoiForm(formData);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    if (Object.keys(parsed.data).length === 0) return { ok: false, message: "입력한 값이 없습니다." };

    const { changes } = await saveRoiInputs(getDb(), parsed.data, { id: admin.id, name: admin.name });
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: changes === 0 ? "바뀐 값이 없습니다." : `저장했습니다. (변경 ${changes}건, 변경 이력에 기록됨)`,
    };
  } catch (error) {
    console.error("ROI 입력 저장 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: "저장하지 못했습니다. 다시 시도하세요." };
  }
}

export async function saveInfraAction(_prev: FormState, formData: FormData): Promise<FormState> {
  // 화면에서 숨겨도 안전하지 않다. 저장할 때마다 서버에서 관리자인지 다시 확인한다.
  const admin = await requireAdmin();

  try {
    const parsed = parseInfraForm(formData);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    if (parsed.data === null) return { ok: false, message: "입력한 값이 없습니다." };

    const { changes } = await saveInfraMetrics(getDb(), parsed.data, { id: admin.id, name: admin.name });
    // 대시보드 계기판이 바로 바뀌도록 화면을 새로 만든다.
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: changes === 0 ? "바뀐 값이 없습니다." : `저장했습니다. (변경 ${changes}건, 변경 이력에 기록됨)`,
    };
  } catch (error) {
    console.error("인프라 지표 저장 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: "저장하지 못했습니다. 다시 시도하세요." };
  }
}
