"use server";

// Design Ref: §7 서버 기능 — 계정 추가·삭제·비밀번호 재설정 (관리자만, 마지막 관리자 삭제 금지)
import { revalidatePath } from "next/cache";

import { createAccount, deleteAccount, resetPassword } from "@/lib/accounts";
import { requireAdmin } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

const SYSTEM_ERROR = "처리하지 못했습니다. 다시 시도하세요.";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  try {
    const result = await createAccount(
      getDb(),
      {
        loginId: text(formData, "loginId"),
        name: text(formData, "name"),
        role: text(formData, "role"),
        password: text(formData, "password"),
      },
      { id: admin.id, name: admin.name },
    );
    if (!result.ok) return { ok: false, message: result.error };
    revalidatePath("/admin/accounts");
    return { ok: true, message: "계정을 만들었습니다." };
  } catch (error) {
    console.error("계정 추가 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: SYSTEM_ERROR };
  }
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  try {
    const result = await resetPassword(getDb(), Number(text(formData, "accountId")), text(formData, "password"), {
      id: admin.id,
      name: admin.name,
    });
    if (!result.ok) return { ok: false, message: result.error };
    revalidatePath("/admin/accounts");
    return { ok: true, message: "비밀번호를 다시 설정했습니다. 열려 있던 로그인은 끊어졌습니다." };
  } catch (error) {
    console.error("비밀번호 재설정 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: SYSTEM_ERROR };
  }
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  try {
    const result = await deleteAccount(getDb(), Number(text(formData, "accountId")), { id: admin.id, name: admin.name });
    if (!result.ok) return { ok: false, message: result.error };
    revalidatePath("/admin/accounts");
    return { ok: true, message: "계정을 삭제했습니다." };
  } catch (error) {
    console.error("계정 삭제 오류:", error instanceof Error ? error.message : "알 수 없는 오류");
    return { ok: false, message: SYSTEM_ERROR };
  }
}
