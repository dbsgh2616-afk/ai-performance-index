"use client";

import { useActionState } from "react";

import { PASSWORD_RULE_MESSAGE } from "@/lib/auth/password";
import type { FormState } from "@/lib/form-state";

import { createAccountAction, deleteAccountAction, resetPasswordAction } from "./actions";

const initialState: FormState = {};
const inputClass = "rounded border border-zinc-300 bg-transparent px-2 py-1.5 dark:border-zinc-600";

function Message({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? "text-xs text-emerald-700 dark:text-emerald-400" : "text-xs text-red-600 dark:text-red-400"}
    >
      {state.message}
    </p>
  );
}

export function CreateAccountForm() {
  const [state, formAction, pending] = useActionState(createAccountAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="text-lg font-bold">계정 추가</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          아이디
          <input name="loginId" type="text" autoComplete="off" required className={`${inputClass} font-normal`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          이름
          <input name="name" type="text" autoComplete="off" required className={`${inputClass} font-normal`} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          권한
          <select name="role" defaultValue="viewer" className={`${inputClass} font-normal`}>
            <option value="viewer">조회자 (조회만)</option>
            <option value="admin">관리자 (입력·수정·계정 관리)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          처음 비밀번호
          <input name="password" type="password" autoComplete="new-password" required className={`${inputClass} font-normal`} />
        </label>
      </div>
      <p className="text-xs text-zinc-500">비밀번호 규칙: {PASSWORD_RULE_MESSAGE} 처음 비밀번호는 만든 사람이 계정 주인에게 직접 전달합니다.</p>
      <Message state={state} />
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "만드는 중…" : "계정 만들기"}
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ accountId, loginId }: { accountId: number; loginId: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <details className="text-xs">
      <summary className="cursor-pointer">비밀번호 다시 설정</summary>
      <form action={formAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="accountId" value={accountId} />
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="새 비밀번호"
          aria-label={`${loginId} 새 비밀번호`}
          className={`${inputClass} w-44`}
        />
        <button type="submit" disabled={pending} className="w-fit rounded border border-zinc-400 px-2 py-1 disabled:opacity-60">
          {pending ? "설정 중…" : "설정"}
        </button>
        <Message state={state} />
      </form>
    </details>
  );
}

export function DeleteAccountForm({
  accountId,
  loginId,
  disabledReason,
}: {
  accountId: number;
  loginId: string;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`계정 ${loginId}을(를) 삭제할까요? 이 계정이 남긴 입력 기록과 변경 이력은 그대로 남습니다.`)) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-1 text-xs"
    >
      <input type="hidden" name="accountId" value={accountId} />
      <button
        type="submit"
        disabled={pending || !!disabledReason}
        title={disabledReason}
        className="w-fit rounded border border-red-400 px-2 py-1 text-red-700 disabled:opacity-50 dark:text-red-300"
      >
        {pending ? "삭제 중…" : "삭제"}
      </button>
      {disabledReason && <span className="text-zinc-500">{disabledReason}</span>}
      <Message state={state} />
    </form>
  );
}
