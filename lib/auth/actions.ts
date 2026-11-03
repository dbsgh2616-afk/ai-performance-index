"use server";

// Design Ref: §7 서버 기능 — 로그인 / 로그아웃 (Server Action)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getDb } from "../db";
import { authenticate } from "./login";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "./session";

export type LoginState = { error?: string };

const loginSchema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력하세요."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});

const INVALID_MESSAGE = "아이디 또는 비밀번호가 맞지 않습니다.";
const LOCKED_MESSAGE = "로그인에 5회 연속 실패했습니다. 15분 뒤에 다시 시도하세요.";
const SYSTEM_ERROR_MESSAGE = "로그인하지 못했습니다. 잠시 후 다시 시도하세요.";

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    loginId: formData.get("loginId"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? INVALID_MESSAGE };
  }

  let token: string;
  try {
    const result = await authenticate(getDb(), parsed.data.loginId, parsed.data.password);
    if (!result.ok) {
      return { error: result.reason === "locked" ? LOCKED_MESSAGE : INVALID_MESSAGE };
    }
    token = await createSessionToken({
      accountId: result.account.id,
      sessionVersion: result.account.sessionVersion,
    });
  } catch (error) {
    // 접속 주소나 비밀 값은 기록하지 않고 오류 메시지만 남긴다.
    // drizzle은 DB의 진짜 오류를 cause에 담아 두므로 함께 남긴다. (원인을 찾을 수 있게)
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
    console.error("로그인 처리 오류:", error instanceof Error ? error.message.split("\n")[0] : "알 수 없는 오류", cause);
    return { error: SYSTEM_ERROR_MESSAGE };
  }

  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions());
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
