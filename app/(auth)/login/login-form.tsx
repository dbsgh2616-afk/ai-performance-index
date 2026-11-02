"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const expired = useSearchParams().get("expired") === "1";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {expired && !state.error && (
        <p role="status" className="rounded bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          자동 로그아웃되었습니다. 다시 로그인하세요.
        </p>
      )}

      <label className="flex flex-col gap-1 text-sm font-medium">
        아이디
        <input
          name="loginId"
          type="text"
          autoComplete="username"
          required
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded border border-zinc-300 bg-transparent px-3 py-2 font-normal dark:border-zinc-600"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
